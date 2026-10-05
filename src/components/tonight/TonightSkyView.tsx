import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  SILHOUETTE_CLASS,
  SILHOUETTE_PATH,
  SILHOUETTE_VIEWBOX,
  SLIDER_ROW_CLASS,
  STRIP_HEIGHT_PX,
  VERDICT_CONTAINER_CLASS,
  VERDICT_MIN_HEIGHT_CLASS,
} from "@/components/tonight/sky-band";
import { buttonVariants } from "@/components/ui/button";
import { getMessages } from "@/i18n";
import { BRIGHT_STARS } from "@/lib/catalogue/stars";
import { starName } from "@/lib/catalogue/star-names";
import { mixPercentages, skyMix } from "@/lib/sky-view/colour";
import { frameTime, nearestFrame, timeFormatter } from "@/lib/sky-view/frames";
import { placeLabels, type LabelItem, type Rect } from "@/lib/sky-view/labels";
import { project, starRadius } from "@/lib/sky-view/projection";
import { rotateToHorizon } from "@/lib/sky-view/rotate";
import type { TonightSkyBody, TonightSkyView as SkyViewData } from "@/lib/sky-view/view";
import { cn } from "@/lib/utils";

/*
 * Tonight's live sky band (interactive-sky): the dashboard's whole sky when the view carries a `skyView`. Top to
 * bottom: the verdict (server-rendered `VerdictCard`, passed in as children), a horizon panorama of the real bright
 * stars, the top targets, the planets and the Moon at the slider's time, the horizon silhouette, and on the ground the
 * time slider from sunset to sunrise with the dark window marked on its track. The band's gradient follows the Sun
 * (`skyMix`, the `dusk-band` utility); its top stays `--zenith`, so it continues the Topbar's strip without a seam.
 *
 * The panorama is twice the viewport wide and covers 360°, scrolled at load to centre `facing`; swipe for the rest.
 * Stars are one path (hidden in the light theme, `hidden dark:block`); a marker is an SVG link named for the body, its
 * altitude and direction at the slider's time, with a 24 px hit area and a `--ring` focus circle.
 *
 * Browser-safe on purpose: it imports only `@/lib/sky-view/*`, the star catalogue (`stars.ts`, `star-names.ts`),
 * `sky-band`, `@/i18n`, `cn` and `buttonVariants`, never astronomy-engine or the engine (`TonightSkyView.test.ts`).
 * JavaScript is required here, as everywhere in the Tonight island.
 */

type Locale = Parameters<typeof getMessages>[0];

interface TonightSkyViewProps {
  view: SkyViewData;
  locale: Locale;
  /** The verdict, server-rendered. */
  children?: ReactNode;
}

/** The strip's width before the browser measures it: a 390 px phone. */
const DEFAULT_VIEWPORT_PX = 390;
/** Rough glyph widths of the caption role (12 px Archivo), for label placement without measuring text. */
const BODY_CHAR_PX = 7;
const STAR_CHAR_PX = 6.4;
const LABEL_HEIGHT_PX = 14;
/** Half of a marker's 24 px hit area. */
const HIT_PX = 12;

const nowButtonClass = buttonVariants({ variant: "outline", size: "sm" });

/*
 * MoonTimeSlider's range input, with the track drawn transparent: the visible track and the dark window's span are an
 * overlay behind it, so the span needs no gradient. 44 px tall for touch; -mt-1.75 centres the 20 px thumb on the
 * 6 px WebKit track; Firefox centres it itself.
 */
const rangeClass = cn(
  "relative block h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
  "[&::-webkit-slider-thumb]:-mt-1.75 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-primary",
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
  "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
  "[&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-primary",
);

/** Where `fraction` of the track falls under the thumb's centre: the thumb (1.25 rem) never leaves the input. */
const trackAt = (fraction: number) => `calc(0.625rem + (100% - 1.25rem) * ${fraction.toFixed(4)})`;
const trackSpan = (fraction: number) => `calc((100% - 1.25rem) * ${fraction.toFixed(4)})`;

/**
 * A projected point to 0.1 px: the server and the browser can differ in a float's last digit (their `Math.asin` and
 * `atan2`), which would make hydration report mismatched attributes; a tenth of a pixel is invisible.
 */
function placeAt(
  point: { altDeg: number; azDeg: number },
  facing: SkyViewData["facing"],
  viewport: number,
  height: number,
) {
  const { x, y } = project(point, facing, viewport, height);
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** A label's candidate rectangles beside a dot at (x, y): right, left, then above and below for bodies. */
function labelRects(x: number, y: number, width: number, gap: number, withVertical: boolean): Rect[] {
  const middle = y - LABEL_HEIGHT_PX / 2;
  const rects = [
    { x: x + gap, y: middle, width, height: LABEL_HEIGHT_PX },
    { x: x - gap - width, y: middle, width, height: LABEL_HEIGHT_PX },
  ];
  if (withVertical) {
    rects.push(
      { x: x - width / 2, y: y - gap - LABEL_HEIGHT_PX, width, height: LABEL_HEIGHT_PX },
      { x: x - width / 2, y: y + gap, width, height: LABEL_HEIGHT_PX },
    );
  }
  return rects;
}

interface PlacedBody {
  body: TonightSkyBody;
  x: number;
  y: number;
  altDeg: number;
  azDeg: number;
}

export default function TonightSkyView({ view, locale, children }: TonightSkyViewProps) {
  const m = getMessages(locale);
  const t = m.tonight.sky;
  const last = Math.max(0, view.frameCount - 1);
  const [index, setIndex] = useState(() => Math.min(Math.max(view.initialIndex, 0), last));
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT_PX);
  const scroller = useRef<HTMLDivElement>(null);

  // Measure the strip's viewport, and keep `facing` in the middle of it after every resize.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth > 0) setViewport(element.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, [viewport]);

  const formatTime = useMemo(() => timeFormatter(locale, view.timeZone), [locale, view.timeZone]);
  const time = formatTime(frameTime(view, index));
  const stripWidth = viewport * 2;
  const height = STRIP_HEIGHT_PX;

  // Every star above the horizon as one path of circles, plus the named ones as label candidates.
  const stars = useMemo(() => {
    let path = "";
    const named: LabelItem[] = [];
    const names = new Map<string, string>();
    for (const star of BRIGHT_STARS) {
      const point = rotateToHorizon(view.rotations, index, star.vector);
      if (point.altDeg <= 0) continue;
      const { x, y } = placeAt(point, view.facing, viewport, height);
      const r = starRadius(star.mag);
      path += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
      if (star.name) {
        const id = `star-${String(star.id)}`;
        const name = starName(star.name, locale);
        names.set(id, name);
        named.push({ id, kind: "star", mag: star.mag, rects: labelRects(x, y, name.length * STAR_CHAR_PX, 4, false) });
      }
    }
    return { path, named, names };
  }, [view.rotations, view.facing, index, viewport, height, locale]);

  // Bodies above the horizon at this frame, from the server's refracted tracks.
  const bodies = useMemo(
    () =>
      view.bodies.flatMap((body): PlacedBody[] => {
        const altDeg = (body.track[2 * index] ?? 0) / 10;
        const azDeg = (body.track[2 * index + 1] ?? 0) / 10;
        if (altDeg <= 0) return [];
        return [{ body, altDeg, azDeg, ...placeAt({ altDeg, azDeg }, view.facing, viewport, height) }];
      }),
    [view.bodies, view.facing, index, viewport, height],
  );

  const labels = useMemo(() => {
    const items: LabelItem[] = bodies.map(({ body, x, y }) => ({
      id: body.key,
      kind: "body",
      rects: labelRects(x, y, body.label.length * BODY_CHAR_PX + 2, 8, true),
    }));
    const obstacles = bodies.map(({ x, y }) => ({ x: x - 6, y: y - 6, width: 12, height: 12 }));
    const placed = placeLabels([...items, ...stars.named], { width: stripWidth, height }, obstacles);
    return new Map(placed.map((label) => [label.id, label.rect]));
  }, [bodies, stars.named, stripWidth, height]);

  const { outer, inner } = mixPercentages(skyMix(view.sunAltDeg[index] ?? -90));
  const bandStyle: CSSProperties & Record<`--${string}`, string> = {
    "--dusk-glow-share": outer,
    "--dusk-twilight-share": inner,
  };
  const darkSpan = view.darkSpan;

  return (
    <div>
      <div className="dusk-band relative overflow-hidden" style={bandStyle} data-sky-band>
        <div className={cn(VERDICT_CONTAINER_CLASS, VERDICT_MIN_HEIGHT_CLASS)}>{children}</div>

        <div
          ref={scroller}
          role="region"
          aria-label={t.panorama}
          tabIndex={0}
          className="scrollbar-strip focus-visible:outline-ring relative overflow-x-auto overflow-y-hidden overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2"
          data-sky-strip
        >
          <svg
            width={stripWidth}
            height={height}
            viewBox={`0 0 ${String(stripWidth)} ${String(height)}`}
            className="block"
            data-sky-frame={index}
          >
            <g className="hidden dark:block" aria-hidden="true">
              <path d={stars.path} className="fill-star" />
              {stars.named.map((star) => {
                const rect = labels.get(star.id);
                return (
                  rect && (
                    <text
                      key={star.id}
                      x={rect.x}
                      y={rect.y + 11}
                      className="fill-muted-foreground text-caption"
                      data-star-label
                    >
                      {stars.names.get(star.id)}
                    </text>
                  )
                );
              })}
            </g>
            {bodies.map(({ body, x, y, altDeg, azDeg }) => {
              const rect = labels.get(body.key);
              const direction = m.compass[Math.round(azDeg / 22.5) % 16];
              const hitY = Math.min(Math.max(y - HIT_PX, 0), height - 2 * HIT_PX);
              return (
                <a
                  key={body.key}
                  href={body.href}
                  aria-label={t.bodyLabel({ name: body.name, alt: String(Math.round(altDeg)), direction, time })}
                  className="group cursor-pointer outline-none"
                  data-sky-body={body.kind}
                  data-key={body.key}
                >
                  <rect x={x - HIT_PX} y={hitY} width={2 * HIT_PX} height={2 * HIT_PX} className="fill-transparent" />
                  {body.kind === "object" && (
                    <circle cx={x} cy={y} r={4} strokeWidth={1.5} className="stroke-primary-strong fill-none" />
                  )}
                  {body.kind === "planet" && <circle cx={x} cy={y} r={3} className="fill-heading" />}
                  {body.kind === "moon" && (
                    <circle cx={x} cy={y} r={5.5} strokeWidth={1} className="fill-moon-lit stroke-moon-limb" />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={HIT_PX + 1}
                    strokeWidth={2}
                    className="stroke-ring hidden fill-none group-focus-visible:block"
                  />
                  {rect && (
                    <text
                      x={rect.x}
                      y={rect.y + 11}
                      aria-hidden="true"
                      className="fill-heading text-caption font-semibold group-hover:underline"
                    >
                      {body.label}
                    </text>
                  )}
                </a>
              );
            })}
          </svg>
        </div>

        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={SILHOUETTE_VIEWBOX}
          preserveAspectRatio="none"
          className={SILHOUETTE_CLASS}
        >
          <path d={SILHOUETTE_PATH}></path>
        </svg>
      </div>

      <div className={SLIDER_ROW_CLASS}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-heading text-title font-mono" data-sky-time>
            {time}
          </span>
          <button
            type="button"
            className={nowButtonClass}
            onClick={() => {
              setIndex(nearestFrame(view, Date.now()));
            }}
          >
            {t.now}
          </button>
        </div>
        <div className="relative mt-1">
          <div
            aria-hidden="true"
            className="bg-border pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          >
            {darkSpan && last > 0 && (
              <span
                className="bg-primary-strong absolute inset-y-0 rounded-full"
                style={{
                  left: trackAt(darkSpan.from / last),
                  width: trackSpan((darkSpan.to - darkSpan.from) / last),
                }}
                data-dark-span
              />
            )}
          </div>
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={index}
            onChange={(event) => {
              setIndex(Number(event.currentTarget.value));
            }}
            aria-label={t.slider}
            aria-valuetext={time}
            className={rangeClass}
          />
        </div>
        <div
          className="text-muted-foreground text-label flex items-center justify-between gap-3 font-mono"
          aria-hidden="true"
        >
          <span>{view.startLabel}</span>
          {darkSpan && (
            <span className="flex items-center gap-1.5 font-sans">
              <span className="bg-primary-strong h-1.5 w-4 rounded-full" />
              {t.darkWindow}
            </span>
          )}
          <span>{view.endLabel}</span>
        </div>
      </div>
    </div>
  );
}

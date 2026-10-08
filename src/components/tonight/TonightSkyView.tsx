import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  SILHOUETTE_CLASS,
  SILHOUETTE_PATH,
  SILHOUETTE_VIEWBOX,
  SLIDER_LABELS_CLASS,
  SLIDER_LAYOUT_CLASS,
  SLIDER_NOW_CLASS,
  SLIDER_ROW_CLASS,
  SLIDER_TIME_CLASS,
  SLIDER_TRACK_CLASS,
  STRIP_HEIGHT_PX,
  STRIP_OVERLAP_CLASS,
  STRIP_OVERLAP_PX,
  VERDICT_CONTAINER_CLASS,
  VERDICT_MIN_HEIGHT_CLASS,
} from "@/components/tonight/sky-band";
import { rangeClasses } from "@/components/tonight/range-classes";
import { buttonVariants } from "@/components/ui/button";
import { getMessages } from "@/i18n";
import { BRIGHT_STARS } from "@/lib/catalogue/stars";
import { starName } from "@/lib/catalogue/star-names";
import { COMPASS_POINTS, COMPASS_STEP_DEG, compassPoint, isCardinal, type CompassPoint } from "@/lib/compass";
import { mixPercentages, skyMix } from "@/lib/sky-view/colour";
import { nearestToCentre } from "@/lib/sky-view/compass-marker";
import { nearestFrame } from "@/lib/sky-view/frames";
import { bodyLabelRects, labelRects, leaderLine, placeLabels, type LabelItem } from "@/lib/sky-view/labels";
import { project, starRadius } from "@/lib/sky-view/projection";
import { rotateToHorizon } from "@/lib/sky-view/rotate";
import {
  placeSliderLabels,
  samePlacement,
  type SliderLabelId,
  type SliderLabelPlacement,
} from "@/lib/sky-view/slider-labels";
import type { TonightSkyBody, TonightSkyView as SkyViewData } from "@/lib/sky-view/view";
import { cn } from "@/lib/utils";

/*
 * Tonight's live sky band (interactive-sky): the dashboard's whole sky when the view carries a `skyView`. Top to
 * bottom: the verdict (server-rendered `VerdictCard`, passed in as children), a horizon panorama of the real bright
 * stars, the top targets, the planets and the Moon at the slider's time, the horizon silhouette, and on the ground the
 * time slider from sunset to sunrise with the dark window marked on its track. The band's gradient follows the Sun
 * (`skyMix`, the `dusk-band` utility); its top stays `--zenith`, so it continues the Topbar's strip without a seam.
 *
 * The panorama covers 360° on a strip about twice the viewport wide (a little narrower, `EDGE_INSET_PX`, so E and W
 * show whole at load), scrolled at load to centre `facing`; swipe for the rest, or use the chevron at each edge
 * (ui-sky-light), which pans most of a viewport and hides once its end is reached.
 * Its star field reaches `STRIP_OVERLAP_PX` (64 px) up behind the verdict's empty lower area. The verdict stays on top but
 * takes no pointer events (it has nothing interactive), so taps and swipes over the overlap reach the panorama. The
 * overlap holds stars only: no star label, and a body there has its label below the overlap, beside the column if
 * another body's label is there, with a leader line back to the dot when the label sits far from it.
 * Stars are one path, shown under a night sky (`hidden night:block`): the band is a `night-sky` scope, so in the light
 * theme it stays a navy night with its stars (ui-sky-light); a marker is an SVG link named for the body, its
 * altitude and direction at the slider's time, with a 24 px hit area and a `--ring` focus circle.
 * Along the field's top edge a compass row names the 16 points (compass-labels), international in every locale
 * (`@/lib/compass`), cardinals stronger. It sits just under the verdict's text, wherever that ends: the island measures
 * it (the verdict's slot is `display: contents`, so through a `Range`), and the row stays invisible until measured. The
 * scrollbar is hidden; instead the label nearest the middle of the view is marked (heading ink, semibold, a short bar
 * under it), so the row says which way you are looking.
 * The slider's track draws the dark window at its exact edges (`view.dark`), with the server's times under them and the
 * short zone muted after the current time; the browser only measures the labels to drop any that would collide.
 *
 * Browser-safe on purpose: it imports only `@/lib/sky-view/*`, `@/lib/compass`, the star catalogue (`stars.ts`, `star-names.ts`),
 * `sky-band`, `range-classes`, `@/i18n`, `cn` and `buttonVariants`, never astronomy-engine or the engine
 * (`TonightSkyView.test.ts`). Every time shown is the server's (`view.timeLabels`), so hydration never re-formats one.
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
/** Half of a marker's 24 px hit area. */
const HIT_PX = 12;
/** The focus ring's radius; its centre stays this far plus half its 2 px stroke inside the strip, so it never clips. */
const RING_PX = HIT_PX + 1;
const RING_INSET_PX = RING_PX + 1;
/** The compass row's gap under the verdict's text, and its highest place in the field. */
const COMPASS_GAP_PX = 8;
const COMPASS_MIN_TOP_PX = 4;
/** How far a chevron pans the strip, as a share of the visible width (ui-sky-light). */
const PAN_SHARE = 0.6;
/** The least gap between two slider labels, px. */
const LABEL_GAP_PX = 8;

/**
 * The panorama's edge chevrons (ui-sky-light, bare since ui-user-adjustments): a 44 px target over the strip's middle,
 * above the verdict's layer. The face is just the icon in heading ink, faint at rest (they are only a suggestion) and
 * full on hover or focus; `--ring` focus outline on the target.
 */
const PAN_BUTTON_CLASS =
  "group focus-visible:outline-ring absolute z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2";
const PAN_FACE_CLASS =
  "text-heading flex size-8 items-center justify-center opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none";

/** The compass row's height: its lowest top keeps it this far above the labels, which start at the overlap's foot. */
const COMPASS_ROW_PX = 16;
/**
 * How far inside the viewport's edges the 180° view's ends sit at load: the field is drawn this much narrower per side,
 * so the first view shows a little more than 180° and E and W (W and E facing north) are whole, not cut in half.
 */
const EDGE_INSET_PX = 8;
/** The caption role's line: a label's top to its baseline. */
const CAPTION_BASELINE_PX = 11;
/** The marker's bar under the compass label nearest the middle: 3 px under the baseline, 2 px thick, so it ends at the row's foot. */
const COMPASS_BAR_GAP_PX = 3;
const COMPASS_BAR_PX = 2;

const nowButtonClass = buttonVariants({ variant: "outline", size: "sm" });

/*
 * The shared range input (`range-classes.ts`) with its track drawn transparent: the visible track and the dark
 * window's span are an overlay behind it, so the span needs no gradient.
 */
const rangeClass = cn("relative", rangeClasses("transparent"));

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

/** One compass label on the row: its point, x and which way its text extends from x. */
interface CompassLabel {
  point: CompassPoint;
  x: number;
  anchor: "start" | "middle" | "end";
}

/** A compass label's identity: the wrap-edge point is drawn twice, so its x tells the two copies apart. */
const compassKey = ({ point, x }: CompassLabel) => `${point}-${String(x)}`;

/** The key of the compass label nearest the middle of the scroller's visible part; `null` for an empty row. */
function nearestCompassKey(scroller: HTMLElement, compass: readonly CompassLabel[]): string | null {
  const index = nearestToCentre(
    compass.map(({ x }) => x),
    scroller.scrollLeft + scroller.clientWidth / 2,
  );
  return index < 0 ? null : compassKey(compass[index]);
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
  const verdict = useRef<HTMLDivElement>(null);
  const field = useRef<SVGSVGElement>(null);
  // The compass row's top in the field, once the verdict's text has been measured.
  const [compassTop, setCompassTop] = useState<number | null>(null);
  // Whether the strip sits at its left or right end: that edge's chevron hides (both do when nothing overflows).
  const [edges, setEdges] = useState({ start: true, end: true });
  // The key of the compass label nearest the middle of the visible strip (`compassKey`); `null` before the first read.
  const [currentCompass, setCurrentCompass] = useState<string | null>(null);
  // The slider's edge labels: the track's box, each label's element (measured) and which fit, once measured.
  const trackBox = useRef<HTMLDivElement>(null);
  const labelEls = useRef<Partial<Record<SliderLabelId, HTMLSpanElement | null>>>({});
  const [labelPlacement, setLabelPlacement] = useState<SliderLabelPlacement | null>(null);
  const panButtons = useRef<Record<"left" | "right", HTMLButtonElement | null>>({ left: null, right: null });
  const pendingFocus = useRef<"left" | "right" | "strip" | null>(null);
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    (target === "strip" ? scroller.current : panButtons.current[target])?.focus();
  }, [edges]);
  const readEdges = () => {
    const element = scroller.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    const next = { start: element.scrollLeft <= 1, end: element.scrollLeft >= max - 1 };
    // A chevron that just reached its end hides: hand keyboard focus to the other one, or to the strip when both hide
    // (nothing overflows any more), rather than drop it on the page. Applied after the render (the effect above), since the
    // other chevron may still be hidden until then.
    const { left, right } = panButtons.current;
    const focused = document.activeElement;
    if (next.start && next.end && (focused === left || focused === right)) pendingFocus.current = "strip";
    else if (next.end && focused === right) pendingFocus.current = "left";
    else if (next.start && focused === left) pendingFocus.current = "right";
    // Scroll events fire every frame of a swipe: keep the same state object unless an edge actually changed.
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  };
  // A chevron pans most of a viewport, keeping a strip of overlap so the eye keeps its place.
  const pan = (direction: -1 | 1) => {
    const element = scroller.current;
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * PAN_SHARE, behavior: smooth ? "smooth" : "auto" });
  };

  // Measure the strip's viewport before the first paint (so a desktop doesn't flash the 390 px default), and keep
  // `facing` in the middle of it after every resize. React 19 runs layout effects only in the browser, without an SSR
  // warning.
  useLayoutEffect(() => {
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
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
    readEdges();
  }, [viewport]);

  // Where the verdict's text ends, relative to the star field's top: the compass row goes just under it, never higher
  // than the field's top edge and never lower than the overlap's foot. Re-measured when the verdict reflows.
  useLayoutEffect(() => {
    const box = verdict.current;
    const svg = field.current;
    if (!box || !svg) return;
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(box);
      const rect = range.getBoundingClientRect();
      // No laid-out text (an empty slot) gives a zero rect at the viewport's origin: keep the row at the top edge.
      const textBottom = rect.height > 0 ? rect.bottom - svg.getBoundingClientRect().top : 0;
      const top = Math.min(
        Math.max(textBottom + COMPASS_GAP_PX, COMPASS_MIN_TOP_PX),
        STRIP_OVERLAP_PX - COMPASS_ROW_PX,
      );
      setCompassTop(Math.round(top));
    };
    measure();
    // The box keeps its minimum height while its text reflows (the display font swapping in, say), so watch the
    // slot's elements too, and measure again once the fonts are in.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    for (const child of box.querySelectorAll(":scope > astro-slot > *, :scope > *")) observer.observe(child);
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, []);

  const time = view.timeLabels[index] ?? "";
  // Half the field: the viewport less the edge insets, so the 180° view's ends sit inside the screen at load.
  const half = Math.max(viewport - 2 * EDGE_INSET_PX, 1);
  const stripWidth = half * 2;
  // The star field: the strip plus the overlap behind the verdict; altitude 0–90° spans all of it.
  const height = STRIP_HEIGHT_PX + STRIP_OVERLAP_PX;

  // Every star above the horizon as one path of circles, plus the named ones as label candidates.
  const stars = useMemo(() => {
    let path = "";
    const named: LabelItem[] = [];
    const names = new Map<string, string>();
    for (const star of BRIGHT_STARS) {
      const point = rotateToHorizon(view.rotations, index, star.vector);
      // `!(> 0)` also skips NaN, which would otherwise put `MNaN` into the one path and blank the whole field.
      if (!(point.altDeg > 0)) continue;
      const { x, y } = placeAt(point, view.facing, half, height);
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
  }, [view.rotations, view.facing, index, half, height, locale]);

  // Bodies above the horizon at this frame, from the server's refracted tracks.
  const bodies = useMemo(
    () =>
      view.bodies.flatMap((body): PlacedBody[] => {
        const altDeg = (body.track[2 * index] ?? 0) / 10;
        const azDeg = (body.track[2 * index + 1] ?? 0) / 10;
        if (!(altDeg > 0)) return [];
        return [{ body, altDeg, azDeg, ...placeAt({ altDeg, azDeg }, view.facing, half, height) }];
      }),
    [view.bodies, view.facing, index, half, height],
  );

  // The 16 points across the 360° strip; the one on the wrap edge (opposite `facing`) is drawn at both ends.
  const compass = useMemo(
    () =>
      COMPASS_POINTS.flatMap((point, i): CompassLabel[] => {
        const { x } = placeAt({ altDeg: 0, azDeg: i * COMPASS_STEP_DEG }, view.facing, half, height);
        // The point opposite `facing` sits on the strip's two real ends: anchor each copy inwards so it shows whole.
        if (x < 1) {
          return [
            { point, x: 0, anchor: "start" },
            { point, x: stripWidth, anchor: "end" },
          ];
        }
        return [{ point, x, anchor: "middle" }];
      }),
    [view.facing, half, height, stripWidth],
  );

  // Marks the compass label whose x is nearest the middle of the visible strip. The strip's content x is the SVG's x, so
  // the middle is `scrollLeft + clientWidth / 2`; the state changes only when the nearest label does.
  const readCentre = () => {
    const element = scroller.current;
    if (!element) return;
    const key = nearestCompassKey(element, compass);
    setCurrentCompass((prev) => (prev === key ? prev : key));
  };
  // After the first layout and whenever the strip is redrawn or recentred (the earlier effect sets `scrollLeft`).
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const key = nearestCompassKey(element, compass);
    setCurrentCompass((prev) => (prev === key ? prev : key));
  }, [compass, viewport]);

  // The slider's edge labels: measure each (the browser's text widths, in the page's font) and the track, and show
  // those that fit. The texts are the server's; only their widths and places are decided here.
  useLayoutEffect(() => {
    const box = trackBox.current;
    if (!box) return;
    const place = () => {
      const width = (id: SliderLabelId) => labelEls.current[id]?.offsetWidth ?? 0;
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const next = placeSliderLabels({
        trackWidth: box.clientWidth,
        // The range thumb is 1.25 rem wide (`range-classes.ts`).
        thumbPx: 1.25 * (rootPx > 0 ? rootPx : 16),
        gapPx: LABEL_GAP_PX,
        widths: {
          sunset: width("sunset"),
          darkStart: width("darkStart"),
          darkEnd: width("darkEnd"),
          darkMerged: width("darkMerged"),
          sunrise: width("sunrise"),
        },
        dark: view.dark,
      });
      setLabelPlacement((prev) => (samePlacement(prev, next) ? prev : next));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(box);
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) place();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [view.dark, view.startLabel, view.endLabel]);

  const labels = useMemo(() => {
    const items: LabelItem[] = bodies.map(({ body, x, y }) => ({
      id: body.key,
      kind: "body",
      rects: bodyLabelRects(x, y, body.label.length * BODY_CHAR_PX + 2, STRIP_OVERLAP_PX),
    }));
    const obstacles = bodies.map(({ x, y }) => ({ x: x - 6, y: y - 6, width: 12, height: 12 }));
    const bounds = { width: stripWidth, height, top: STRIP_OVERLAP_PX };
    const placed = placeLabels([...items, ...stars.named], bounds, obstacles);
    return new Map(placed.map((label) => [label.id, label.rect]));
  }, [bodies, stars.named, stripWidth, height]);

  const { outer, inner } = mixPercentages(skyMix(view.sunAltDeg[index] ?? -90));
  const bandStyle: CSSProperties & Record<`--${string}`, string> = {
    "--dusk-glow-share": outer,
    "--dusk-twilight-share": inner,
  };
  const dark = view.dark;
  // The labels under the slider's track, in their stacking order: texts from the server, `hook` the e2e contract.
  const sliderLabels: {
    id: SliderLabelId;
    text: string;
    className: string;
    hook: Record<string, string>;
  }[] = [
    { id: "sunset", text: view.startLabel, className: "text-muted-foreground", hook: { "data-sky-start": "" } },
    ...(dark
      ? [
          {
            id: "darkStart" as const,
            text: dark.startLabel,
            className: "text-heading",
            hook: { "data-sky-dark-start": "" },
          },
          {
            id: "darkEnd" as const,
            text: dark.endLabel,
            className: "text-heading",
            hook: { "data-sky-dark-end": "" },
          },
          {
            id: "darkMerged" as const,
            text: `${dark.startLabel}–${dark.endLabel}`,
            className: "text-heading",
            hook: { "data-sky-dark-merged": "" },
          },
        ]
      : []),
    { id: "sunrise", text: view.endLabel, className: "text-muted-foreground", hook: { "data-sky-end": "" } },
  ];

  return (
    <div>
      <div className="dusk-band night-sky relative overflow-hidden" style={bandStyle} data-sky-band>
        {/*
         * Above the strip's overlap, and transparent to the pointer: the verdict has no links or buttons, so taps and
         * swipes anywhere over the overlap reach the panorama's markers and scroll. A link in the verdict would need
         * its own `pointer-events-auto`.
         */}
        <div
          ref={verdict}
          className={cn(VERDICT_CONTAINER_CLASS, VERDICT_MIN_HEIGHT_CLASS, "pointer-events-none z-10")}
        >
          {children}
        </div>

        <div className={cn("relative", STRIP_OVERLAP_CLASS)}>
          <div
            ref={scroller}
            role="region"
            aria-label={t.panorama}
            tabIndex={0}
            className="scrollbar-hidden focus-visible:outline-ring relative overflow-x-auto overflow-y-hidden overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2"
            onScroll={() => {
              readEdges();
              readCentre();
            }}
            data-sky-strip
          >
            <svg
              ref={field}
              width={stripWidth}
              height={height}
              viewBox={`0 0 ${String(stripWidth)} ${String(height)}`}
              className="block"
              data-sky-frame={index}
            >
              <g aria-hidden="true" className={cn(compassTop === null && "invisible")} data-sky-compass>
                {compass.map((entry) => {
                  const { point, x, anchor } = entry;
                  const current = compassKey(entry) === currentCompass;
                  const top = compassTop ?? 0;
                  const barWidth = Math.max(point.length * BODY_CHAR_PX - 2, 8);
                  const barX = anchor === "start" ? x : anchor === "end" ? x - barWidth : x - barWidth / 2;
                  return (
                    <Fragment key={compassKey(entry)}>
                      <text
                        x={x}
                        y={top + CAPTION_BASELINE_PX}
                        textAnchor={anchor}
                        className={cn(
                          "text-caption",
                          current || isCardinal(point) ? "fill-heading font-semibold" : "fill-muted-foreground",
                        )}
                        data-sky-compass-current={current ? point : undefined}
                      >
                        {point}
                      </text>
                      {current && (
                        <rect
                          x={barX}
                          y={top + CAPTION_BASELINE_PX + COMPASS_BAR_GAP_PX}
                          width={barWidth}
                          height={COMPASS_BAR_PX}
                          rx={1}
                          className="fill-heading"
                        />
                      )}
                    </Fragment>
                  );
                })}
              </g>
              <g className="night:block hidden" aria-hidden="true">
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
                const direction = compassPoint(azDeg);
                const hitY = Math.min(Math.max(y - HIT_PX, 0), height - 2 * HIT_PX);
                const ringX = Math.min(Math.max(x, RING_INSET_PX), stripWidth - RING_INSET_PX);
                const ringY = Math.min(Math.max(y, RING_INSET_PX), height - RING_INSET_PX);
                const leader = rect ? leaderLine(x, y, rect) : null;
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
                    {leader && (
                      <line
                        {...leader}
                        strokeWidth={1}
                        aria-hidden="true"
                        className="stroke-muted-foreground"
                        data-sky-leader
                      />
                    )}
                    {body.kind === "object" && (
                      <circle cx={x} cy={y} r={4} strokeWidth={1.5} className="stroke-primary-strong fill-none" />
                    )}
                    {body.kind === "planet" && <circle cx={x} cy={y} r={3} className="fill-heading" />}
                    {body.kind === "moon" && (
                      <circle cx={x} cy={y} r={5.5} strokeWidth={1} className="fill-moon-lit stroke-moon-limb" />
                    )}
                    <circle
                      cx={ringX}
                      cy={ringY}
                      r={RING_PX}
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
          {(["left", "right"] as const).map((side) => {
            const atEdge = side === "left" ? edges.start : edges.end;
            const Icon = side === "left" ? ChevronLeft : ChevronRight;
            return (
              <button
                key={side}
                ref={(element) => {
                  panButtons.current[side] = element;
                }}
                type="button"
                aria-label={side === "left" ? t.panLeft : t.panRight}
                className={cn(PAN_BUTTON_CLASS, side === "left" ? "left-1" : "right-1", atEdge && "invisible")}
                style={{ top: STRIP_OVERLAP_PX + STRIP_HEIGHT_PX / 2 }}
                onClick={() => {
                  pan(side === "left" ? -1 : 1);
                }}
                data-sky-pan={side}
              >
                <span className={PAN_FACE_CLASS}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
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
        <div className={SLIDER_LAYOUT_CLASS}>
          <span className={cn("flex items-baseline gap-1.5", SLIDER_TIME_CLASS)}>
            <span className="text-heading text-title font-mono" data-sky-time>
              {time}
            </span>
            {view.zoneLabel && (
              <span className="text-muted-foreground text-label" data-sky-zone>
                {t.zone({ zone: view.zoneLabel })}
              </span>
            )}
          </span>
          {/*
           * DOM order follows the phone row (time, slider, Now), so Tab matches what a phone shows; from `sm` the
           * order classes lift Now onto the time's line.
           * With a single frame there is nothing to slide (as on the Moon card): the row keeps its height.
           */}
          <div ref={trackBox} className={cn("relative h-11", SLIDER_TRACK_CLASS)}>
            {last > 0 && (
              <>
                <div
                  aria-hidden="true"
                  className="bg-border pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                >
                  {dark && (
                    <span
                      className="bg-primary-strong absolute inset-y-0 rounded-full"
                      style={{ left: trackAt(dark.from), width: trackSpan(dark.to - dark.from) }}
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
              </>
            )}
            {/* Under the track, in its own box so the x positions are the track's; a label that doesn't fit stays hidden. */}
            <div aria-hidden="true" className={SLIDER_LABELS_CLASS} data-sky-labels>
              {sliderLabels.map(({ id, text, className, hook }) => {
                const left = labelPlacement?.[id];
                return (
                  <span
                    key={id}
                    ref={(element) => {
                      labelEls.current[id] = element;
                    }}
                    className={cn(
                      "text-label absolute top-0 font-mono whitespace-nowrap",
                      className,
                      left === undefined && "invisible",
                    )}
                    style={{ left: left ?? 0 }}
                    {...hook}
                  >
                    {text}
                  </span>
                );
              })}
            </div>
          </div>
          {last > 0 && (
            <button
              type="button"
              className={cn(nowButtonClass, SLIDER_NOW_CLASS)}
              onClick={() => {
                setIndex(nearestFrame(view, Date.now()));
              }}
            >
              {t.now}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

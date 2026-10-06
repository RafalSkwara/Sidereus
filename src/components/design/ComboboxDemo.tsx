import { useState } from "react";
import { Combobox } from "@/components/forms/Combobox";
import { getMessages, plural } from "@/i18n";
import { searchCatalogue } from "@/lib/gear/catalogue/search";
import type { Locale } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/** What the `/design` cell shows. The static cells open their list (`defaultOpen`), because hover and focus cannot be forced. */
export type ComboboxDemoKind =
  "live" | "hover" | "focus" | "disabled" | "error" | "empty" | "loading" | "unavailable" | "more";

interface Props {
  id: string;
  kind: ComboboxDemoKind;
  locale: Locale;
  /** The message the error cell shows (the page picks one from the catalogue). */
  error?: string;
}

interface Sample {
  name: string;
  aliases: readonly string[];
  aperture: number;
  focalLength: number;
}

/** Sample telescopes, so the specimens need no catalogue data. */
const SAMPLES: readonly Sample[] = [
  { name: "Sky-Watcher Heritage-130P", aliases: ["Heritage 130"], aperture: 130, focalLength: 650 },
  { name: "Sky-Watcher Skymax-102", aliases: ["Maksutov 102"], aperture: 102, focalLength: 1300 },
  { name: "Celestron AstroMaster 130EQ", aliases: [], aperture: 130, focalLength: 650 },
  { name: "Sky-Watcher Explorer-150P", aliases: ["Explorer 150"], aperture: 150, focalLength: 750 },
];

const getKey = (sample: Sample) => sample.name;
const getLabel = (sample: Sample) => sample.name;

// The cell is as tall as its open list, so neighbours stay clear of the popup.
const OPEN_KINDS: readonly ComboboxDemoKind[] = ["hover", "focus", "empty", "loading", "unavailable", "more"];

/**
 * A hydrated sample of `forms/Combobox` for the kitchen sink (`/design`). Astro cannot hand function props to an island,
 * so the sample options and the `filter` / `getLabel` / `onSelect` functions live here, and the page passes only
 * serialisable props.
 */
export default function ComboboxDemo({ id, kind, locale, error }: Props) {
  const t = getMessages(locale).gearCatalogue;
  const [text, setText] = useState(kind === "empty" ? "zzz" : kind === "focus" ? "Heritage" : "");
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const open = OPEN_KINDS.includes(kind);

  const detail = (sample: Sample) =>
    t.detail.telescope({
      aperture: number.format(sample.aperture),
      focalLength: number.format(sample.focalLength),
      ratio: number.format(sample.focalLength / sample.aperture),
    });

  return (
    <div className={cn(open && "min-h-80")}>
      <Combobox
        id={id}
        label={t.telescope.label}
        placeholder={t.telescope.placeholder}
        options={SAMPLES}
        state={kind === "loading" ? "loading" : kind === "unavailable" ? "unavailable" : "ready"}
        text={text}
        onTextChange={setText}
        filter={searchCatalogue}
        getKey={getKey}
        getLabel={getLabel}
        getDetail={detail}
        onSelect={(sample) => {
          setText(sample.name);
        }}
        hint={t.telescope.hint}
        status={{
          noMatch: t.telescope.noMatch,
          loading: t.telescope.loading,
          unavailable: t.telescope.unavailable,
          more: (hidden) => plural(locale, hidden, t.telescope.more)({ count: number.format(hidden) }),
        }}
        maxResults={kind === "more" ? 2 : 50}
        error={kind === "error" ? error : undefined}
        disabled={kind === "disabled"}
        defaultOpen={open}
        defaultActive={kind === "hover" ? 1 : undefined}
        inputClassName={kind === "focus" ? "border-ring ring-1 ring-ring" : undefined}
      />
    </div>
  );
}

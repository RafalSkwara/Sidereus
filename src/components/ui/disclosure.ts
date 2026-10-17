/*
 * The native `<details>` disclosure's shared parts (ui-progress-rewards): `Band`'s `collapsed` heading and the progress
 * page's "Seen so far" list use the same summary and chevron, so the two cannot drift apart. The summary is at least
 * 44 px, its hover tint and focus ring run a little past the text inside the column, and the browser's marker is
 * hidden (the chevron replaces it). Each use adds its own layout (gap, justify) and type.
 *
 * The chevron turns through a NAMED group on its own `<details>` (`group/band` with `group-open/band:rotate-180`,
 * `group/seen` with `group-open/seen:rotate-180`), never a bare `group`: `group-open:` matches any open `.group`
 * ancestor, so a closed disclosure nested in an open one would show "open" (impl review F1). In red mode the chevron's
 * direction is the only visible state cue.
 */
export const DISCLOSURE_SUMMARY_CLASS = [
  "-mx-2 flex min-h-11 cursor-pointer list-none items-center rounded-lg px-2 [&::-webkit-details-marker]:hidden",
  "transition-colors hover:bg-accent motion-reduce:transition-none",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
].join(" ");

/** The chevron beside the summary's text; the rotation comes from the named group at the use site. */
export const DISCLOSURE_CHEVRON_CLASS =
  "size-5 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none";

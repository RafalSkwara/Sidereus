import type { SkyCheckRecord } from "./store";

/**
 * Which night Tonight asks about (verdict-check): the newest unanswered, unskipped night at the shown site from
 * the two nights before Tonight's own. Older nights stay answerable on the sky checks page.
 */

/** How many nights back Tonight's question reaches: last night and the night before. */
export const SKY_CHECK_PROMPT_NIGHTS = 2;

/**
 * How far back `openRecent` reads, in days before today's UTC date. A site's Tonight date can trail the UTC date by
 * up to two days (a zone west of UTC, plus a night still in progress before its civil dawn), so the read reaches two
 * days further back than the prompt and covers every site's window.
 */
const OPEN_READ_DAYS = SKY_CHECK_PROMPT_NIGHTS + 2;

/** The calendar date `days` before `date` (both `YYYY-MM-DD`). Calendar arithmetic in UTC, so no DST shifts. */
export function nightsBefore(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

/** The earliest night `openRecent` needs to read for Tonight's question at `now`, in any site's time zone. */
export function openSkyChecksSince(now: Date): string {
  return nightsBefore(now.toISOString().slice(0, 10), OPEN_READ_DAYS);
}

/**
 * The night Tonight asks about for one site, or `null`: the newest open check at the site with
 * `tonightDate − 2 days <= night < tonightDate`. ISO dates compare correctly as strings.
 */
export function pendingCheck(
  open: readonly SkyCheckRecord[],
  siteId: string,
  tonightDate: string,
): SkyCheckRecord | null {
  const earliest = nightsBefore(tonightDate, SKY_CHECK_PROMPT_NIGHTS);
  const candidates = open.filter(
    (check) =>
      check.siteId === siteId &&
      check.answer === null &&
      !check.skipped &&
      check.night >= earliest &&
      check.night < tonightDate,
  );
  return candidates.reduce<SkyCheckRecord | null>(
    (newest, check) => (newest === null || check.night > newest.night ? check : newest),
    null,
  );
}

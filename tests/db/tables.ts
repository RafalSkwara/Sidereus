/**
 * The classification of every table in `public`, shared by the behavioural and the structural suites.
 *
 * - A per-user table (RLS plus one SELECT, INSERT, UPDATE and DELETE policy keyed on `auth.uid()`) goes in
 *   `TABLES` with a valid row and a valid change: isolation.test.ts then proves cross-user and anonymous refusals
 *   on it, and structure.test.ts checks its policies.
 * - A server-owned, read-only table (writes revoked from `anon` and `authenticated`, `select` granted back) goes in
 *   `SERVER_OWNED` and gets its own suite asserting the `42501` refusals, as account-plans.test.ts does.
 *
 * structure.test.ts fails on any table in `public` that is in neither list, so a new table cannot go unchecked.
 */
import type { Database, TablesInsert } from "@/lib/database.types";

export interface TableCase<T extends keyof Database["public"]["Tables"]> {
  table: T;
  /** A valid row, without user_id (the column defaults to auth.uid()). */
  valid: TablesInsert<T>;
  /** A valid change applied by the owner (positive control) and attempted by the other user. */
  change: Database["public"]["Tables"][T]["Update"];
}

export const TABLES = [
  {
    table: "sites",
    valid: {
      name: "Back garden",
      latitude_deg: 52.23,
      longitude_deg: 21.01,
      bortle: 6,
      min_altitude_deg: 15,
      time_zone: "Europe/Warsaw",
      time_zone_source: "auto",
    },
    change: { name: "Changed site" },
  } satisfies TableCase<"sites">,
  {
    table: "telescopes",
    valid: { name: "Dobsonian 8in", aperture_mm: 203, focal_length_mm: 1200 },
    change: { name: "Changed telescope" },
  } satisfies TableCase<"telescopes">,
  {
    table: "eyepieces",
    valid: { name: "Plossl 25", focal_length_mm: 25, afov_deg: 52 },
    change: { name: "Changed eyepiece" },
  } satisfies TableCase<"eyepieces">,
  {
    // Gear references are nullable (an entry outlives its site and telescope), so the row needs no gear of
    // A's; the referenced-gear guard has its own suite in observations.test.ts.
    table: "observations",
    valid: {
      target: "M13",
      night: "2026-09-26",
      rating: 4,
      site_id: null,
      telescope_id: null,
      site_name: "Home",
      telescope_name: "Dobsonian 8in",
    },
    // Changing the target also exercises the target key check on update under RLS.
    change: { target: "jupiter", rating: 2 },
  } satisfies TableCase<"observations">,
  {
    // The site reference is nullable (a check outlives its site), and the unique key on (user, site, night) treats
    // null sites as distinct, so the row can be inserted repeatedly; the site guard and the recording function have
    // their own suite in sky-checks.test.ts.
    table: "sky_checks",
    valid: {
      site_id: null,
      site_name: "Home",
      night: "2026-09-26",
      headline: "go",
      dark_start: "2026-09-26T18:30:00Z",
    },
    change: { answer: "clear" },
  } satisfies TableCase<"sky_checks">,
] as const;

/** Server-owned tables: users may read their own row and nothing else. */
export const SERVER_OWNED: readonly string[] = ["account_plans"];

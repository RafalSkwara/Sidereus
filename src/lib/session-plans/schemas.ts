import { z } from "zod";
import type { MessageKey } from "@/i18n";
import { isCalendarDate } from "@/lib/observations/schemas";
import { isTargetKey, type TargetKey } from "@/lib/targets";

/**
 * One definition of a valid session-plan form post (adjustable-session-plan), shared by the plan editor and
 * `POST /api/tonight/plan` and `POST /api/tonight/plan/reset`. Input is FormData-shaped (strings; `targets` is every
 * `targets` entry of the form, in the user's order).
 *
 * Every error message is a message key (`@/i18n`), never a sentence and never the submitted value: the routes put it
 * into a redirect URL. These schemas check shapes only. Whether the catalogue lists an NGC or IC key
 * (`isKnownTarget`, which imports the catalogue), whether the site is the user's own, whether the night is tonight
 * and whether an added key has a window that night are the route's checks, so this module stays island-safe: it
 * imports only zod, the observation schemas' date check and the target key grammar.
 */

/** The most targets one edited plan holds, the same limit as the table's check. */
export const SESSION_PLAN_MAX_TARGETS = 30;

const INVALID: MessageKey = "errors.save.sessionPlan";

const site = z.uuid({ error: INVALID });
const night = z.string({ error: INVALID }).refine(isCalendarDate, { error: INVALID });

export const savePlanSchema = z.object({
  site,
  night,
  /** Target keys in the user's order: each a well-formed key, none twice, at most `SESSION_PLAN_MAX_TARGETS`. */
  targets: z
    .array(z.custom<TargetKey>(isTargetKey, { error: INVALID }), { error: INVALID })
    .max(SESSION_PLAN_MAX_TARGETS, { error: INVALID })
    .refine((keys) => new Set(keys).size === keys.length, { error: INVALID }),
});

export type SavePlanInput = z.infer<typeof savePlanSchema>;

export const resetPlanSchema = z.object({ site, night });

export type ResetPlanInput = z.infer<typeof resetPlanSchema>;

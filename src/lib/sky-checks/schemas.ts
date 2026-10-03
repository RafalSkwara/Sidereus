import { z } from "zod";
import { SKY_ANSWERS } from "./claim";

/**
 * One definition of a valid sky-check form post (verdict-check), shared by Tonight's card, the sky checks page and
 * `POST /api/log/sky/[id]`. Input is FormData-shaped (strings).
 *
 * Every error message is a message key (`@/i18n`): the route puts it into a redirect URL. `from` only picks which
 * page the route returns to, so an unknown value falls back to the sky checks page instead of failing the answer.
 *
 * Island-safe: imports only zod and the answer vocabulary.
 */

export const SKY_CHECK_ACTIONS = [...SKY_ANSWERS, "skip"] as const;

export type SkyCheckAction = (typeof SKY_CHECK_ACTIONS)[number];

export const SKY_CHECK_RETURNS = ["tonight", "sky"] as const;

export type SkyCheckReturn = (typeof SKY_CHECK_RETURNS)[number];

export const skyCheckActionSchema = z.object({
  action: z.enum(SKY_CHECK_ACTIONS, { error: "errors.save.skyCheck" }),
  from: z.enum(SKY_CHECK_RETURNS).catch("sky"),
});

import type { APIRoute } from "astro";
import { issueKey, NOT_CONFIGURED } from "@/lib/api-errors";
import { skyCheckedRedirect, skyCheckErrorRedirect } from "@/lib/sky-checks/redirect";
import { skyCheckActionSchema, type SkyCheckReturn } from "@/lib/sky-checks/schemas";
import { skyCheckStore } from "@/lib/sky-checks/store";

/*
 * Answers, changes or skips one sky check (verdict-check), from Tonight's card or the sky checks page. RLS makes
 * another user's night indistinguishable from a missing one, and a night whose dark window has not started reads
 * as missing too; all come back as the store's fixed "not found" key. Only fixed keys reach the URL: never the
 * answer or any form value. Nothing is logged.
 */
export const POST: APIRoute = async (context) => {
  const raw = Object.fromEntries((await context.request.formData()).entries());
  const parsed = skyCheckActionSchema.safeParse(raw);
  const from: SkyCheckReturn = parsed.success ? parsed.data.from : "sky";

  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect(skyCheckErrorRedirect(from, NOT_CONFIGURED));
  }
  if (!parsed.success) {
    return context.redirect(skyCheckErrorRedirect(from, issueKey(parsed.error)));
  }

  const id = context.params.id ?? "";
  const now = new Date();
  const { action } = parsed.data;
  const result =
    action === "skip"
      ? await skyCheckStore.skip(supabase, id, now)
      : await skyCheckStore.answer(supabase, id, action, now);
  if (!result.ok) {
    return context.redirect(skyCheckErrorRedirect(from, result.message));
  }
  return context.redirect(skyCheckedRedirect(from));
};

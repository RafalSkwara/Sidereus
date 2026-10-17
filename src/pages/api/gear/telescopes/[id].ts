import type { APIRoute } from "astro";
import { CHECK_FIELDS, NOT_CONFIGURED, issueKey, readForm } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { telescopeInputSchema } from "@/lib/gear/schemas";
import { telescopeStore } from "@/lib/gear/store";
import { saveFailureKey } from "@/lib/observability/save-failure";

/*
 * Every `?error=` value is a fixed message key (`@/i18n`): schema and store messages are keys by
 * design (`issueKey` drops anything else), so no submitted value ever reaches the URL.
 * A failed write goes through `saveFailureKey` (`save.gear`): a server fault logs one line with only its code
 * and status and redirects with `errors.serverFault`; nothing submitted is ever logged. A body that is not a
 * form redirects with `errors.checkFields` and logs `request.form`.
 */
export const POST: APIRoute = async (context) => {
  const id = context.params.id ?? "";
  const fail = (message: MessageKey) =>
    context.redirect(`/gear/telescopes/${encodeURIComponent(id)}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const form = await readForm(context.request);
  if (!form) {
    return fail(CHECK_FIELDS);
  }
  const parsed = telescopeInputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }

  const result = await telescopeStore.update(supabase, id, parsed.data);
  if (!result.ok) {
    return fail(saveFailureKey("save.gear", result));
  }
  return context.redirect("/gear?saved=telescope");
};

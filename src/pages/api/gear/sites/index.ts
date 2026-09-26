import type { APIRoute } from "astro";
import { NOT_CONFIGURED, issueKey } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { siteInputSchema } from "@/lib/gear/schemas";
import { siteStore } from "@/lib/gear/store";

const FORM = "/gear/sites/new";

/*
 * Every `?error=` value is a fixed message key (`@/i18n`): schema and store messages are keys by
 * design (`issueKey` drops anything else), so no submitted value (coordinates included) ever
 * reaches the URL. Nothing is logged.
 * The store resolves the time zone itself, so the route only validates and forwards.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: MessageKey) => context.redirect(`${FORM}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = siteInputSchema.safeParse(Object.fromEntries(await context.request.formData()));
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }

  const result = await siteStore.create(supabase, parsed.data);
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect("/gear");
};

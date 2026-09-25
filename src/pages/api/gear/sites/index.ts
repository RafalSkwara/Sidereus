import type { APIRoute } from "astro";
import { siteInputSchema } from "@/lib/gear/schemas";
import { siteStore } from "@/lib/gear/store";

const FORM = "/gear/sites/new";
const NOT_CONFIGURED = "The database is not configured.";
const CHECK_FIELDS = "Check the highlighted fields.";

/*
 * Every `?error=` value is a fixed string: schema messages are static by design and store messages
 * are fixed, so no submitted value (coordinates included) ever reaches the URL. Nothing is logged.
 * The store resolves the time zone itself, so the route only validates and forwards.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: string) => context.redirect(`${FORM}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = siteInputSchema.safeParse(Object.fromEntries(await context.request.formData()));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? CHECK_FIELDS);
  }

  const result = await siteStore.create(supabase, parsed.data);
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect("/gear");
};

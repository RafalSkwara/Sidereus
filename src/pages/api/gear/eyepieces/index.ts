import type { APIRoute } from "astro";
import { eyepieceInputSchema } from "@/lib/gear/schemas";
import { eyepieceStore } from "@/lib/gear/store";

const FORM = "/gear/eyepieces/new";
const NOT_CONFIGURED = "The database is not configured.";
const CHECK_FIELDS = "Check the highlighted fields.";

/*
 * Every `?error=` value is a fixed string: schema messages are static by design and store messages
 * are fixed, so no submitted value ever reaches the URL. Nothing is logged.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: string) => context.redirect(`${FORM}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = eyepieceInputSchema.safeParse(Object.fromEntries(await context.request.formData()));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? CHECK_FIELDS);
  }

  const result = await eyepieceStore.create(supabase, parsed.data);
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect("/gear");
};

import type { APIRoute } from "astro";
import { NOT_CONFIGURED, issueKey } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { formRedirect } from "@/lib/observations/redirect";
import { observationInputSchema } from "@/lib/observations/schemas";
import { observationStore } from "@/lib/observations/store";

/*
 * Saves one observation log entry (roadmap S-06) and returns to Tonight, which confirms it. Every
 * `?error=` value is a fixed message key, and the prefill carried back is filtered by `formRedirect`,
 * so no typed value (and never a coordinate) reaches the URL. Nothing is logged.
 */
export const POST: APIRoute = async (context) => {
  const raw = Object.fromEntries(await context.request.formData());
  const fail = (message: MessageKey) => context.redirect(formRedirect(raw, message));

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = observationInputSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }

  const result = await observationStore.create(supabase, parsed.data, new Date());
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect(`/tonight?logged=${parsed.data.messier}`);
};

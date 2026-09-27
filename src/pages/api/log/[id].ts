import type { APIRoute } from "astro";
import { NOT_CONFIGURED, issueKey } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { editRedirect, logNotice } from "@/lib/observations/redirect";
import { observationUpdateSchema } from "@/lib/observations/schemas";
import { observationStore } from "@/lib/observations/store";

/*
 * Saves an edited log entry (roadmap S-07, FR-017) and returns to the log, which confirms it. A failure goes
 * back to the entry's page with a fixed message key only (`editRedirect`), so no typed value reaches the URL.
 * Nothing is logged.
 */
export const POST: APIRoute = async (context) => {
  const id = context.params.id ?? "";
  const fail = (message: MessageKey) => context.redirect(editRedirect(id, message));

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = observationUpdateSchema.safeParse(Object.fromEntries(await context.request.formData()));
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }

  const result = await observationStore.update(supabase, id, parsed.data, new Date());
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect(logNotice("updated", parsed.data.messier));
};

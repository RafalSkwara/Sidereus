import type { APIRoute } from "astro";
import { CHECK_FIELDS, NOT_CONFIGURED, issueKey, readForm } from "@/lib/api-errors";
import { getMessages, type MessageKey } from "@/i18n";
import { onboardingInputSchema } from "@/lib/onboarding/schemas";
import { completeOnboarding } from "@/lib/onboarding/store";
import { saveFailureKey } from "@/lib/observability/save-failure";

const FORM = "/onboarding";

/*
 * Saves the whole first-run setup (site, telescope, eyepieces) in one transaction, then opens Tonight.
 *
 * Every `?error=` value is a fixed message key (`@/i18n`): schema and store messages are keys by
 * design (`issueKey` drops anything else), so no submitted value (coordinates included) ever
 * reaches the URL. A failed save goes through `saveFailureKey` (`save.onboarding`): a server fault logs one line with
 * only its code and status and redirects with `errors.serverFault`; a body that is not a form redirects with
 * `errors.checkFields` and logs `request.form`; nothing submitted is ever logged. A user who already has gear (a
 * retry or a double submit) is sent to Tonight as if the save had just succeeded.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: MessageKey) => context.redirect(`${FORM}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const form = await readForm(context.request);
  if (!form) {
    return fail(CHECK_FIELDS);
  }
  const parsed = onboardingInputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }

  const result = await completeOnboarding(supabase, parsed.data, {
    siteName: getMessages(context.locals.locale).onboarding.homeSiteName,
  });
  if (!result.ok && result.reason === "failed") {
    return fail(saveFailureKey("save.onboarding", result));
  }
  return context.redirect("/tonight");
};

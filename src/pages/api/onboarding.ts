import type { APIRoute } from "astro";
import { NOT_CONFIGURED, issueKey } from "@/lib/api-errors";
import { getMessages, type MessageKey } from "@/i18n";
import { onboardingInputSchema } from "@/lib/onboarding/schemas";
import { completeOnboarding } from "@/lib/onboarding/store";

const FORM = "/onboarding";

/*
 * Saves the whole first-run setup (site, telescope, eyepieces) in one transaction, then opens Tonight.
 *
 * Every `?error=` value is a fixed message key (`@/i18n`): schema and store messages are keys by
 * design (`issueKey` drops anything else), so no submitted value (coordinates included) ever
 * reaches the URL. Nothing is logged. A user who already has gear (a retry or a double submit) is
 * sent to Tonight as if the save had just succeeded.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: MessageKey) => context.redirect(`${FORM}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = onboardingInputSchema.safeParse(Object.fromEntries(await context.request.formData()));
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }

  const result = await completeOnboarding(supabase, parsed.data, {
    siteName: getMessages(context.locals.locale).onboarding.homeSiteName,
  });
  if (!result.ok && result.reason === "failed") {
    return fail(result.message);
  }
  return context.redirect("/tonight");
};

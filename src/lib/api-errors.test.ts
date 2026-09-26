import { describe, expect, it } from "vitest";
import { getMessages, translateKey } from "@/i18n";
import { siteInputSchema } from "@/lib/gear/schemas";
import { authErrorKey, CHECK_FIELDS, issueKey, NOT_CONFIGURED } from "./api-errors";

describe("authErrorKey", () => {
  it.each([
    ["invalid_credentials", "errors.auth.invalidCredentials"],
    ["user_already_exists", "errors.auth.userExists"],
    ["weak_password", "errors.auth.weakPassword"],
    ["email_address_invalid", "errors.auth.invalidEmail"],
    ["over_request_rate_limit", "errors.auth.rateLimited"],
    ["over_email_send_rate_limit", "errors.auth.emailRateLimited"],
  ])("maps %s to %s", (code, key) => {
    expect(authErrorKey({ code })).toBe(key);
  });

  it.each([[{}], [{ code: "unexpected_failure" }], [{ code: "toString" }]])(
    "falls back to the generic key for %j",
    (error) => {
      expect(authErrorKey(error)).toBe("errors.auth.generic");
    },
  );
});

describe("issueKey", () => {
  it("passes a schema's key through", () => {
    const parsed = siteInputSchema.safeParse({ name: "Home", latitudeDeg: "95" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(issueKey(parsed.error)).toBe("errors.site.latitudeRange");
    }
  });

  it("never lets a non-key message into the URL", () => {
    const parsed = siteInputSchema.safeParse(null);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(issueKey(parsed.error)).toBe(CHECK_FIELDS);
    }
  });
});

describe("shared route keys", () => {
  it("read as before in English", () => {
    const en = getMessages("en");
    expect(translateKey(en, NOT_CONFIGURED, "errors.generic")).toBe("The database is not configured.");
    expect(translateKey(en, CHECK_FIELDS, "errors.generic")).toBe("Check the highlighted fields.");
  });
});

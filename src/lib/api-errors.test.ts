import { describe, expect, it } from "vitest";
import { siteInputSchema } from "@/lib/gear/schemas";
import { authErrorKey, CHECK_FIELDS, issueKey } from "./api-errors";

describe("authErrorKey", () => {
  it("maps known Supabase error codes to keys and anything else to the generic key", () => {
    expect(authErrorKey({ code: "invalid_credentials" })).toBe("errors.auth.invalidCredentials");
    expect(authErrorKey({ code: "user_already_exists" })).toBe("errors.auth.userExists");
    expect(authErrorKey({ code: "weak_password" })).toBe("errors.auth.weakPassword");
    expect(authErrorKey({ code: "email_address_invalid" })).toBe("errors.auth.invalidEmail");
    expect(authErrorKey({ code: "over_request_rate_limit" })).toBe("errors.auth.rateLimited");
    expect(authErrorKey({ code: "over_email_send_rate_limit" })).toBe("errors.auth.emailRateLimited");
    for (const error of [{}, { code: "unexpected_failure" }, { code: "toString" }]) {
      expect(authErrorKey(error)).toBe("errors.auth.generic");
    }
  });
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

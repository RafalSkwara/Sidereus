declare namespace App {
  interface Locals {
    user: import("@/lib/supabase").SessionUser | null;
    supabase: import("@/lib/supabase").TypedSupabaseClient | null;
    theme: import("@/lib/preferences").Theme;
    locale: import("@/lib/preferences").Locale;
    /** The live sky's mode on the Tonight dashboard (ui-sky-modes), from the `sidereus-sky` cookie. */
    skyMode: import("@/lib/preferences").SkyMode;
    /** The instant a loopback-only test cookie pins the request to (src/lib/clock.ts); absent in production. */
    testNow?: Date;
  }
}

declare namespace App {
  interface Locals {
    user: import("@/lib/supabase").SessionUser | null;
    supabase: import("@/lib/supabase").TypedSupabaseClient | null;
    theme: import("@/lib/preferences").Theme;
    locale: import("@/lib/preferences").Locale;
    /** The instant a loopback-only test cookie pins the request to (src/lib/clock.ts); absent in production. */
    testNow?: Date;
  }
}

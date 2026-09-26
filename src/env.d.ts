declare namespace App {
  interface Locals {
    user: import("@/lib/supabase").SessionUser | null;
    supabase: import("@/lib/supabase").TypedSupabaseClient | null;
    theme: import("@/lib/preferences").Theme;
    locale: import("@/lib/preferences").Locale;
  }
}

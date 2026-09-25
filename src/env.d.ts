declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    supabase: import("@/lib/supabase").TypedSupabaseClient | null;
  }
}

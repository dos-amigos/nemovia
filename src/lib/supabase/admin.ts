import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using service role key.
 * Bypasses RLS — only use in server actions behind auth check.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

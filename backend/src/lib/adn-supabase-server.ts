import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getAdnSupabaseServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key) {
    throw new Error(
      "Storage ADN: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (servidor apenas).",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

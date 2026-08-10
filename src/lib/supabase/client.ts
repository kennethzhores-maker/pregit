import { createBrowserClient } from "@supabase/ssr";

import { hasSupabaseConfig } from "@/lib/auth/config";

export function createClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured. Enable demo mode or set env vars.");
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

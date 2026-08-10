import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { DEMO_COOKIE, hasSupabaseConfig, isDemoMode } from "@/lib/auth/config";

export type AppUser = {
  id: string;
  email: string;
  isDemo: boolean;
};

export async function createClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware will refresh sessions.
          }
        },
      },
    },
  );
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();

  if (isDemoMode()) {
    const demo = cookieStore.get(DEMO_COOKIE)?.value;
    if (demo === "1") {
      return {
        id: "demo-user",
        email: "demo@footballpredict.local",
        isDemo: true,
      };
    }
  }

  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return {
    id: user.id,
    email: user.email,
    isDemo: false,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_COOKIE, hasSupabaseConfig, isDemoMode } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
};

export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (!hasSupabaseConfig()) {
    return {
      error:
        "Supabase is not configured. Use Continue as guest, or add your project keys to .env.local.",
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { error: "Unable to create Supabase client." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/fixtures");
}

export async function signUpWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (!hasSupabaseConfig()) {
    return {
      error:
        "Supabase is not configured. Use Continue as guest, or add your project keys to .env.local.",
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { error: "Unable to create Supabase client." };
  }

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/fixtures");
}

export async function continueAsGuest() {
  if (!isDemoMode()) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  revalidatePath("/", "layout");
  redirect("/fixtures");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);

  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase?.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

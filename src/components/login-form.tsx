"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  continueAsGuest,
  signInWithPassword,
  signUpWithPassword,
  type AuthState,
} from "@/app/auth/actions";

const initialState: AuthState = {};

export function LoginForm({
  mode,
  demoEnabled,
}: {
  mode: "login" | "signup";
  demoEnabled: boolean;
}) {
  const action = mode === "login" ? signInWithPassword : signUpWithPassword;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="w-full max-w-md space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm text-[var(--muted)]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[var(--foreground)] outline-none ring-[var(--pitch)] focus:ring-2"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm text-[var(--muted)]">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[var(--foreground)] outline-none ring-[var(--pitch)] focus:ring-2"
            placeholder="••••••••"
          />
        </div>

        {state.error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-[var(--pitch)] px-4 py-2.5 font-medium text-[var(--pitch-ink)] transition hover:brightness-110 disabled:opacity-60"
        >
          {pending
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="text-[var(--accent)] hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>

      {demoEnabled ? (
        <form action={continueAsGuest}>
          <button
            type="submit"
            className="w-full rounded-md border border-dashed border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Continue as guest (demo)
          </button>
        </form>
      ) : null}
    </div>
  );
}

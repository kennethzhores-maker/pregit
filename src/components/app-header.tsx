import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { getUserPlan } from "@/lib/product/plans";
import type { AppUser } from "@/lib/supabase/server";

export async function AppHeader({ user }: { user: AppUser }) {
  const plan = await getUserPlan(user.id);

  return (
    <header className="border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/fixtures" className="group flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-[var(--pitch)]">
              PREGIT
            </span>
            <span className="hidden text-xs uppercase tracking-[0.22em] text-[var(--muted)] sm:inline">
              Match Predict
            </span>
          </Link>
          <nav className="hidden items-center gap-3 text-sm text-[var(--muted)] md:flex">
            <Link href="/fixtures" className="hover:text-[var(--accent)]">
              Fixtures
            </Link>
            <Link href="/simulation" className="hover:text-[var(--accent)]">
              Simulation
            </Link>
            <Link href="/following" className="hover:text-[var(--accent)]">
              Following
            </Link>
            <Link href="/history" className="hover:text-[var(--accent)]">
              History
            </Link>
            <Link href="/accuracy" className="hover:text-[var(--accent)]">
              Accuracy
            </Link>
            <Link href="/pricing" className="hover:text-[var(--accent)]">
              Pricing
            </Link>
            <Link href="/admin" className="hover:text-[var(--accent)]">
              Admin
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/pricing"
            className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
              plan.plan === "pro"
                ? "bg-[var(--pitch)] text-[var(--pitch-ink)]"
                : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--accent)]"
            }`}
          >
            {plan.label}
          </Link>
          <span className="hidden text-[var(--muted)] sm:inline">
            {user.isDemo ? "Demo session" : user.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[var(--foreground)] transition hover:border-[var(--pitch)] hover:text-[var(--pitch)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { setPlanAction } from "@/app/pricing/actions";
import { AppHeader } from "@/components/app-header";
import {
  getUserPlan,
  MONETIZE_DISCLAIMER,
} from "@/lib/product/plans";
import { FREE_DAILY_PREDICT_LIMIT } from "@/lib/product/config";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function PricingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await getUserPlan(user.id);

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
            Pricing
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            Free covers basic match lean. Pro unlocks unlimited predicts, full
            simulation, timeline narrative, explanations, and history.
          </p>
          <p className="mt-3 text-sm text-[var(--accent)]">{MONETIZE_DISCLAIMER}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Current plan: <span className="text-[var(--foreground)]">{plan.label}</span>
            {" · "}
            Demo billing (no card charged — toggle for product testing).
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PlanCard
            name="Free"
            price="£0"
            active={plan.plan === "free"}
            features={[
              `${FREE_DAILY_PREDICT_LIMIT} predicts / day`,
              "Win / draw / lose probabilities",
              "Most likely scoreline",
              "Short confidence note",
            ]}
            planId="free"
            cta={plan.plan === "free" ? "Current plan" : "Switch to Free"}
            disabled={plan.plan === "free"}
          />
          <PlanCard
            name="Pro"
            price="£9"
            priceNote="/ mo (demo)"
            active={plan.plan === "pro"}
            featured
            features={[
              "Unlimited predicts",
              "Full XI simulation + unit breakdown",
              "Text timeline path",
              "Full explanations & markets",
              "Prediction history & accuracy board",
            ]}
            planId="pro"
            cta={plan.plan === "pro" ? "Current plan" : "Unlock Pro (demo)"}
            disabled={plan.plan === "pro"}
          />
        </div>

        <p className="mt-8 text-sm text-[var(--muted)]">
          Ready to predict?{" "}
          <Link href="/fixtures" className="text-[var(--accent)] hover:underline">
            Browse fixtures
          </Link>
        </p>
      </main>
    </>
  );
}

function PlanCard({
  name,
  price,
  priceNote,
  features,
  planId,
  cta,
  active,
  featured,
  disabled,
}: {
  name: string;
  price: string;
  priceNote?: string;
  features: string[];
  planId: "free" | "pro";
  cta: string;
  active?: boolean;
  featured?: boolean;
  disabled?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border p-6 ${
        featured
          ? "border-[var(--pitch)]/50 bg-[var(--pitch)]/10"
          : "border-[var(--line)] bg-[var(--panel)]/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-wide">
          {name}
        </h2>
        {active ? (
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
            Active
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] text-5xl tracking-wide">
          {price}
        </span>
        {priceNote ? (
          <span className="text-sm text-[var(--muted)]">{priceNote}</span>
        ) : null}
      </div>
      <ul className="mt-6 space-y-2 text-sm text-[var(--muted)]">
        {features.map((feature) => (
          <li key={feature}>
            <span className="mr-2 text-[var(--pitch)]">▸</span>
            {feature}
          </li>
        ))}
      </ul>
      <form action={setPlanAction} className="mt-8">
        <input type="hidden" name="plan" value={planId} />
        <button
          type="submit"
          disabled={disabled}
          className={`w-full rounded-md px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
            featured
              ? "bg-[var(--pitch)] text-[var(--pitch-ink)] hover:brightness-110"
              : "border border-[var(--line)] text-[var(--foreground)] hover:border-[var(--pitch)]"
          }`}
        >
          {cta}
        </button>
      </form>
    </section>
  );
}

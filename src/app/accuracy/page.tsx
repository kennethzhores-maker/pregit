import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ProGate } from "@/components/pro-gate";
import {
  getAccuracySummary,
  listPredictionHistory,
} from "@/lib/predict/history";
import { MONETIZE_DISCLAIMER, getUserPlan } from "@/lib/product/plans";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function AccuracyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await getUserPlan(user.id);

  if (!plan.accuracyAccess) {
    return (
      <>
        <AppHeader user={user} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <h1 className="mb-6 font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
            Accuracy
          </h1>
          <ProGate
            title="Accuracy board is Pro"
            description="See result, BTTS, O2.5, and scoreline hit rates on settled predicts after you upgrade."
          />
        </main>
      </>
    );
  }

  const history = listPredictionHistory();
  const accuracy = getAccuracySummary(history);

  const cards = [
    {
      label: "Match result",
      value: accuracy.resultAccuracyPct,
      detail: `${accuracy.evaluatedCount} evaluated`,
    },
    {
      label: "BTTS",
      value: accuracy.bttsAccuracyPct,
      detail: "Both teams to score",
    },
    {
      label: "Over 2.5",
      value: accuracy.over25AccuracyPct,
      detail: "Total goals market",
    },
    {
      label: "Exact score",
      value: accuracy.exactScoreAccuracyPct,
      detail: "Most-likely scoreline (noisy)",
    },
  ];

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
            Accuracy
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-[var(--foreground)]">
            {accuracy.statement}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Confidence is only treated as reliable when lineups are confirmed.
            Reliable subset:{" "}
            {accuracy.reliableResultAccuracyPct != null
              ? `${accuracy.reliableResultAccuracyPct}% on ${accuracy.reliableSampleSize} samples`
              : "n/a"}
            .
          </p>
          <p className="mt-2 text-xs text-[var(--accent)]">{MONETIZE_DISCLAIMER}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                {card.label}
              </div>
              <div className="mt-3 font-[family-name:var(--font-display)] text-5xl tracking-wide text-[var(--accent)]">
                {card.value == null ? "—" : `${card.value}%`}
              </div>
              <div className="mt-2 text-xs text-[var(--muted)]">{card.detail}</div>
            </div>
          ))}
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Total predictions"
            value={String(accuracy.sampleSize)}
          />
          <Stat
            label="Pending settlement"
            value={String(accuracy.pendingCount)}
          />
          <Stat
            label="Avg confidence"
            value={
              accuracy.avgConfidence == null
                ? "—"
                : `${accuracy.avgConfidence}%`
            }
          />
        </section>

        <p className="mt-8 text-sm text-[var(--muted)]">
          <Link href="/history" className="text-[var(--accent)] hover:underline">
            Browse prediction history
          </Link>{" "}
          to inspect each hit/miss.
        </p>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide">
        {value}
      </div>
    </div>
  );
}

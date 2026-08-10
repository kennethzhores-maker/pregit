import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ProGate } from "@/components/pro-gate";
import {
  getAccuracySummary,
  listPredictionHistory,
} from "@/lib/predict/history";
import { formatKickoff } from "@/lib/data/types";
import { getUserPlan } from "@/lib/product/plans";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await getUserPlan(user.id);

  if (!plan.historyAccess) {
    return (
      <>
        <AppHeader user={user} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <h1 className="mb-6 font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
            Prediction history
          </h1>
          <ProGate
            title="History is Pro"
            description="Browse saved predicts, settlement hits/misses, and confidence notes after you upgrade."
          />
        </main>
      </>
    );
  }

  const history = listPredictionHistory();
  const accuracy = getAccuracySummary(history);

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
              Prediction history
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--muted)]">
              {accuracy.statement}
            </p>
          </div>
          <Link
            href="/accuracy"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View accuracy →
          </Link>
        </div>

        <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]/60">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.6fr] gap-2 border-b border-[var(--line)] px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>Match</span>
            <span>Predicted</span>
            <span>Actual</span>
            <span>Result</span>
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[var(--muted)]">
              No predictions stored yet.
            </p>
          ) : (
            history.map((row) => {
              const actual =
                row.actualHomeScore != null && row.actualAwayScore != null
                  ? `${row.actualHomeScore}-${row.actualAwayScore}`
                  : "Pending";
              return (
                <Link
                  key={row.id}
                  href={`/matches/${row.fixtureId}`}
                  className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.6fr] gap-2 border-b border-[var(--line)] px-4 py-3 text-sm transition hover:bg-[var(--panel-hover)]"
                >
                  <div>
                    <div className="font-medium">
                      {row.homeName} vs {row.awayName}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatKickoff(row.kickoff)} · conf {row.confidence}%
                      {row.confidenceReliable ? "" : " · provisional"}
                    </div>
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-display)] text-lg tracking-wide">
                      {row.mostLikelyScore}
                    </div>
                    <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                      lean {row.predictedResult} ·{" "}
                      {row.homeWinPct.toFixed(0)}/{row.drawPct.toFixed(0)}/
                      {row.awayWinPct.toFixed(0)}
                    </div>
                  </div>
                  <div className="font-[family-name:var(--font-display)] text-lg tracking-wide">
                    {actual}
                  </div>
                  <div>
                    {row.resultCorrect == null ? (
                      <span className="text-[var(--muted)]">—</span>
                    ) : row.resultCorrect ? (
                      <span className="text-emerald-300">Hit</span>
                    ) : (
                      <span className="text-rose-300">Miss</span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </section>
      </main>
    </>
  );
}

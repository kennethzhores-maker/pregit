import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { getAccuracySummary, listPredictionHistory } from "@/lib/predict/history";
import { getAdminSnapshot, recordHealthEvent } from "@/lib/product/admin-health";
import { getUserPlan } from "@/lib/product/plans";
import { getPredictUsage } from "@/lib/product/usage";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Soft ping so empty installs still show activity once opened
  recordHealthEvent("sync", "Admin dashboard viewed", { user: user.email });

  const health = getAdminSnapshot();
  const usage = await getPredictUsage(user.id);
  const plan = await getUserPlan(user.id);
  const accuracy = getAccuracySummary(listPredictionHistory());

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
            Admin
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Sync health, predict throughput, and quota snapshot for this session.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="System" value={health.status} />
          <Stat label="Predicts (recent)" value={String(health.predicts)} />
          <Stat label="Refreshes (recent)" value={String(health.refreshes)} />
          <Stat label="Errors (recent)" value={String(health.errors)} />
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Plan" value={plan.label} />
          <Stat
            label="Your daily quota"
            value={
              usage.unlimited
                ? `${usage.count}/∞`
                : `${usage.count}/${usage.limit}`
            }
          />
          <Stat
            label="Remaining today"
            value={usage.unlimited ? "Unlimited" : String(usage.remaining)}
          />
          <Stat
            label="Result accuracy"
            value={
              accuracy.resultAccuracyPct == null
                ? "—"
                : `${accuracy.resultAccuracyPct}%`
            }
          />
        </section>

        <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)]/60">
          <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Recent events
          </div>
          {health.recent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">
              No events yet. Run a predict or refresh to populate.
            </p>
          ) : (
            <ul>
              {health.recent.map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[6rem_1fr] gap-3 border-b border-[var(--line)] px-4 py-3 text-sm"
                >
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
                    {event.kind}
                  </span>
                  <div>
                    <div>{event.message}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {new Date(event.at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)]/70 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide capitalize">
        {value}
      </div>
    </div>
  );
}

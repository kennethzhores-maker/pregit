"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import type { MethodBreakdown, PredictionResult } from "@/lib/predict/types";

type PlanInfo = {
  id: "free" | "pro";
  label: string;
  entitlements: {
    fullSimulation: boolean;
    timeline: boolean;
    fullExplanations: boolean;
    unlimitedPredicts: boolean;
  };
};

export function PredictPanel({
  fixtureId,
  homeName,
  awayName,
}: {
  fixtureId: string;
  homeName: string;
  awayName: string;
}) {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    limit: number;
    remaining: number;
    count: number;
    plan?: "free" | "pro";
    unlimited?: boolean;
  } | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/predict")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            usage?: PredictionResult["usage"];
            plan?: PlanInfo;
          } | null,
        ) => {
          if (cancelled || !data) return;
          if (data.usage) setUsage(data.usage);
          if (data.plan) setPlan(data.plan);
        },
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function runPredict() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtureId }),
        });
        const data = (await response.json()) as PredictionResult & {
          error?: string;
          usage?: PredictionResult["usage"];
          plan?: "free" | "pro";
        };
        if (data.usage) setUsage(data.usage);
        if (data.plan || data.entitlements) {
          setPlan({
            id: data.plan ?? "free",
            label: (data.plan ?? "free") === "pro" ? "Pro" : "Free",
            entitlements: data.entitlements ?? {
              fullSimulation: false,
              timeline: false,
              fullExplanations: false,
              unlimitedPredicts: false,
            },
          });
        }
        if (!response.ok) {
          setError(data.error ?? "Prediction failed");
          return;
        }
        setPrediction(data);
      } catch {
        setError("Could not reach the prediction service.");
      }
    });
  }

  const isPro =
    prediction?.plan === "pro" ||
    plan?.id === "pro" ||
    usage?.unlimited === true;
  const limitReached =
    !isPro && usage != null && !usage.unlimited && usage.remaining <= 0;
  const showFullSim =
    prediction?.entitlements?.fullSimulation ?? isPro;
  const showTimeline =
    (prediction?.entitlements?.timeline ?? isPro) &&
    !!prediction?.timeline?.length;

  return (
    <section className="rounded-lg border border-[var(--pitch)]/35 bg-[var(--panel)]/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Prediction
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Probabilities and a most-likely score — not a guaranteed exact score.
          </p>
          {usage ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {usage.unlimited || usage.remaining < 0
                ? "Pro · unlimited predicts"
                : `Free predicts today: ${usage.remaining}/${usage.limit} remaining`}
              {" · "}
              <Link href="/pricing" className="text-[var(--accent)] hover:underline">
                Plans
              </Link>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={runPredict}
          disabled={pending || limitReached}
          className="rounded-md bg-[var(--pitch)] px-5 py-2.5 text-sm font-medium text-[var(--pitch-ink)] transition hover:brightness-110 disabled:opacity-60"
        >
          {pending
            ? "Refreshing & predicting…"
            : limitReached
              ? "Daily limit reached"
              : prediction
                ? "Refresh + re-predict"
                : "Predict"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}{" "}
          {limitReached ? (
            <Link href="/pricing" className="underline">
              Upgrade to Pro
            </Link>
          ) : null}
        </p>
      ) : null}

      {prediction ? (
        <div className="mt-6 space-y-5">
          {prediction.refresh ? (
            <div className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-sm text-[var(--muted)]">
              Snapshot {prediction.refresh.snapshotHash} · refreshed{" "}
              {new Date(prediction.refresh.refreshedAt).toLocaleTimeString()} via{" "}
              {prediction.refresh.source} · XI {prediction.refresh.homeXiCount}/
              {prediction.refresh.awayXiCount} ({prediction.refresh.lineupStatus}
              ) · {prediction.refresh.injuryCount} absences
              {prediction.refresh.hoursToKickoff != null
                ? ` · ${prediction.refresh.hoursToKickoff}h to kickoff`
                : ""}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <ProbCard
              label={`${homeName} win`}
              value={prediction.homeWinPct}
              emphasize={
                prediction.homeWinPct >= prediction.drawPct &&
                prediction.homeWinPct >= prediction.awayWinPct
              }
            />
            <ProbCard
              label="Draw"
              value={prediction.drawPct}
              emphasize={
                prediction.drawPct >= prediction.homeWinPct &&
                prediction.drawPct >= prediction.awayWinPct
              }
            />
            <ProbCard
              label={`${awayName} win`}
              value={prediction.awayWinPct}
              emphasize={
                prediction.awayWinPct >= prediction.drawPct &&
                prediction.awayWinPct >= prediction.homeWinPct
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-md border border-[var(--line)] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Most likely score
              </div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide text-[var(--accent)]">
                {prediction.mostLikelyScore}
              </div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                xG {prediction.expectedHomeGoals.toFixed(2)} –{" "}
                {prediction.expectedAwayGoals.toFixed(2)} · confidence{" "}
                {prediction.confidence}%
                {prediction.confidenceReliable ? "" : " (provisional)"}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {prediction.confidenceNote}
              </p>
            </div>

            <div className="rounded-md border border-[var(--line)] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Top scorelines
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {prediction.topScorelines.map((line) => (
                  <li
                    key={`${line.homeGoals}-${line.awayGoals}`}
                    className="flex items-center justify-between"
                  >
                    <span className="font-[family-name:var(--font-display)] text-lg tracking-wide">
                      {line.homeGoals}-{line.awayGoals}
                    </span>
                    <span className="text-[var(--muted)]">
                      {line.probability.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
              {!showFullSim ? (
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Full scoreline board is Pro.{" "}
                  <Link href="/pricing" className="text-[var(--accent)] hover:underline">
                    Upgrade
                  </Link>
                </p>
              ) : null}
            </div>
          </div>

          {showTimeline ? (
            <div className="rounded-md border border-[var(--line)] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Plausible path (text sim)
              </div>
              <ol className="mt-3 space-y-2">
                {prediction.timeline!.map((event, index) => (
                  <li
                    key={`${event.minute}-${event.type}-${index}`}
                    className="grid grid-cols-[2.75rem_1fr] gap-3 text-sm"
                  >
                    <span className="font-[family-name:var(--font-display)] text-[var(--accent)]">
                      {event.minute}&apos;
                    </span>
                    <span
                      className={
                        event.type === "goal"
                          ? "text-[var(--foreground)]"
                          : "text-[var(--muted)]"
                      }
                    >
                      {event.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <LockedStrip label="Text timeline simulation" />
          )}

          {showFullSim ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <MethodCard title="Poisson model" method={prediction.poisson} />
              <MethodCard
                title={`Simulation · ${prediction.simulation.iterations.toLocaleString()} runs`}
                method={prediction.simulation}
                extra={
                  <div className="mt-3 space-y-2 text-xs text-[var(--muted)]">
                    <div>
                      Sim BTTS {prediction.simulation.bttsPct}% · O2.5{" "}
                      {prediction.simulation.over25Pct}%
                    </div>
                    <div>
                      Calibrated BTTS {prediction.markets.bttsPct}% (
                      {prediction.markets.bttsLean}) · O2.5{" "}
                      {prediction.markets.over25Pct}% (
                      {prediction.markets.over25Lean})
                    </div>
                    <div>
                      Home units ATK{" "}
                      {prediction.simulation.homeUnits.attack.toFixed(2)} · MID{" "}
                      {prediction.simulation.homeUnits.midfield.toFixed(2)} · DEF{" "}
                      {prediction.simulation.homeUnits.defence.toFixed(2)} · GK{" "}
                      {prediction.simulation.homeUnits.gk.toFixed(2)}
                    </div>
                    <div>
                      Away units ATK{" "}
                      {prediction.simulation.awayUnits.attack.toFixed(2)} · MID{" "}
                      {prediction.simulation.awayUnits.midfield.toFixed(2)} · DEF{" "}
                      {prediction.simulation.awayUnits.defence.toFixed(2)} · GK{" "}
                      {prediction.simulation.awayUnits.gk.toFixed(2)}
                    </div>
                  </div>
                }
              />
            </div>
          ) : (
            <LockedStrip label="Full simulation & method breakdown" />
          )}

          <div className="rounded-md border border-[var(--line)] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Why this lean
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--foreground)]">
              {prediction.reasons.map((reason) => (
                <li key={reason} className="leading-relaxed text-[var(--muted)]">
                  <span className="mr-2 text-[var(--pitch)]">▸</span>
                  {reason}
                </li>
              ))}
            </ul>
            {!prediction.entitlements?.fullExplanations && !isPro ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Showing Free summary.{" "}
                <Link href="/pricing" className="text-[var(--accent)] hover:underline">
                  Pro unlocks full explanations
                </Link>
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              <span>
                Model {prediction.modelVersion} · {prediction.plan ?? "free"} ·
                source {prediction.source}
              </span>
              <Link href="/pricing" className="text-[var(--accent)] hover:underline">
                Plans
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LockedStrip({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
      {label} —{" "}
      <Link href="/pricing" className="text-[var(--accent)] hover:underline">
        unlock with Pro
      </Link>
    </div>
  );
}

function MethodCard({
  title,
  method,
  extra,
}: {
  title: string;
  method: MethodBreakdown;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        {title}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <div className="text-[var(--muted)]">Home</div>
          <div className="font-[family-name:var(--font-display)] text-2xl">
            {method.homeWinPct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[var(--muted)]">Draw</div>
          <div className="font-[family-name:var(--font-display)] text-2xl">
            {method.drawPct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[var(--muted)]">Away</div>
          <div className="font-[family-name:var(--font-display)] text-2xl">
            {method.awayWinPct.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="mt-3 text-sm text-[var(--muted)]">
        Mode {method.mostLikelyScore} · xG {method.expectedHomeGoals.toFixed(2)}–
        {method.expectedAwayGoals.toFixed(2)}
      </div>
      {extra}
    </div>
  );
}

function ProbCard({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        emphasize
          ? "border-[var(--pitch)]/50 bg-[var(--pitch)]/10"
          : "border-[var(--line)]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide">
        {value.toFixed(1)}%
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--panel-hover)]">
        <div
          className="h-full bg-[var(--pitch)] transition-all duration-700"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

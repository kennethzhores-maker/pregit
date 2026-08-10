"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { LineupStatus } from "@/lib/data/types";

type RefreshPayload = {
  refresh: {
    refreshedAt: string;
    source: string;
    lineupStatus: LineupStatus;
    homeXiCount: number;
    awayXiCount: number;
    injuryCount: number;
    hoursToKickoff: number | null;
    notes: string[];
    changed: boolean;
  };
};

export function KickoffRefreshBar({
  fixtureId,
  lineupStatus,
  homeXiCount,
  awayXiCount,
}: {
  fixtureId: string;
  lineupStatus: LineupStatus;
  homeXiCount: number;
  awayXiCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<RefreshPayload["refresh"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtureId }),
        });
        const data = (await response.json()) as RefreshPayload & {
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Refresh failed");
          return;
        }
        setLast(data.refresh);
        router.refresh();
      } catch {
        setError("Could not refresh match data.");
      }
    });
  }

  const status = last?.lineupStatus ?? lineupStatus;
  const homeCount = last?.homeXiCount ?? homeXiCount;
  const awayCount = last?.awayXiCount ?? awayXiCount;

  return (
    <section className="rounded-lg border border-[var(--accent)]/25 bg-[var(--panel)]/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
            Pre-kickoff refresh
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pull latest XIs & injuries before predicting. Current:{" "}
            <span className="text-[var(--foreground)]">
              {status} · {homeCount}/{awayCount} starters
            </span>
            {last ? (
              <span>
                {" "}
                · refreshed{" "}
                {new Date(last.refreshedAt).toLocaleTimeString()} ({last.source}
                )
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="rounded-md border border-[var(--line)] px-4 py-2 text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
        >
          {pending ? "Refreshing…" : "Refresh now"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-300">{error}</p>
      ) : null}

      {last?.notes?.length ? (
        <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
          {last.notes.map((note) => (
            <li key={note}>▸ {note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

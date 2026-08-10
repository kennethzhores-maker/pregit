import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { FixtureRow } from "@/components/fixture-row";
import { listFixtures } from "@/lib/data/repository";
import { getFollowedTeamIds } from "@/lib/product/follows";
import { getCurrentUser } from "@/lib/supabase/server";

const RECENT_RESULTS_LIMIT = 12;

function byKickoffAsc(
  a: { kickoff: string },
  b: { kickoff: string },
) {
  return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
}

function byKickoffDesc(
  a: { kickoff: string },
  b: { kickoff: string },
) {
  return new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();
}

export default async function FixturesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { fixtures, source } = await listFixtures();
  const followedTeamIds = await getFollowedTeamIds(user.id);
  const followedSet = new Set(followedTeamIds);

  const openStatuses = new Set(["scheduled", "lineups", "live"]);

  const followedOpen = fixtures
    .filter(
      (f) =>
        followedSet.has(f.home.id) || followedSet.has(f.away.id),
    )
    .filter((f) => openStatuses.has(f.status) || f.status === "finished")
    .sort(byKickoffAsc)
    .slice(0, 20);

  const followedIds = new Set(followedOpen.map((f) => f.id));

  const intelligenceReady = fixtures
    .filter(
      (f) =>
        !followedIds.has(f.id) &&
        (f.status === "live" ||
          f.status === "lineups" ||
          f.lineupStatus === "confirmed" ||
          f.lineupStatus === "provisional"),
    )
    .sort(byKickoffAsc);

  const intelligenceIds = new Set(intelligenceReady.map((f) => f.id));

  const upcoming = fixtures
    .filter(
      (f) =>
        f.status === "scheduled" &&
        !intelligenceIds.has(f.id) &&
        !followedIds.has(f.id),
    )
    .sort(byKickoffAsc);

  const allFinished = fixtures
    .filter((f) => f.status === "finished" && !followedIds.has(f.id))
    .sort(byKickoffDesc);

  const recentFinished = allFinished.slice(0, RECENT_RESULTS_LIMIT);
  const hasMoreFinished = allFinished.length > RECENT_RESULTS_LIMIT;

  const hasOpenMatches =
    upcoming.length > 0 ||
    intelligenceReady.length > 0 ||
    followedOpen.some((f) => openStatuses.has(f.status));

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] text-[var(--foreground)] sm:text-5xl">
              Fixtures
            </h1>
            <p className="mt-2 max-w-xl text-[var(--muted)]">
              Open a match and hit Predict for win/draw/lose probabilities and a
              most-likely score.
            </p>
          </div>
          <span className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Source: {source}
          </span>
        </div>

        {!hasOpenMatches ? (
          <div className="mb-8 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-4 text-sm text-[var(--muted)]">
            No upcoming fixtures on the free football API season (2024/25 is
            finished). Showing recent results below — you can still open a match
            and run Predict on historical games. Upgrade API-Football to Pro and
            set <code className="text-[var(--foreground)]">FOOTBALL_SEASON=2026</code>{" "}
            for live matchweeks.
          </div>
        ) : null}

        {followedOpen.length > 0 ? (
          <section className="rounded-xl border border-[var(--pitch)]/40 bg-[var(--panel)]/60">
            <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--pitch)]">
              Following
            </div>
            <div>
              {followedOpen.map((fixture) => (
                <FixtureRow
                  key={fixture.id}
                  fixture={fixture}
                  followedTeamIds={followedTeamIds}
                />
              ))}
            </div>
          </section>
        ) : null}

        {intelligenceReady.length > 0 ? (
          <section
            className={`rounded-xl border border-[var(--accent)]/30 bg-[var(--panel)]/60 ${
              followedOpen.length > 0 ? "mt-8" : ""
            }`}
          >
            <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              Match intelligence ready
            </div>
            <div>
              {intelligenceReady.map((fixture) => (
                <FixtureRow
                  key={fixture.id}
                  fixture={fixture}
                  followedTeamIds={followedTeamIds}
                />
              ))}
            </div>
          </section>
        ) : null}

        {upcoming.length > 0 ? (
          <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)]/60">
            <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Upcoming
            </div>
            <div>
              {upcoming.map((fixture) => (
                <FixtureRow
                  key={fixture.id}
                  fixture={fixture}
                  followedTeamIds={followedTeamIds}
                />
              ))}
            </div>
          </section>
        ) : null}

        {recentFinished.length > 0 ? (
          <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)]/60">
            <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Recent results
              {hasMoreFinished
                ? ` · last ${RECENT_RESULTS_LIMIT} of ${allFinished.length}`
                : ""}
            </div>
            <div>
              {recentFinished.map((fixture) => (
                <FixtureRow
                  key={fixture.id}
                  fixture={fixture}
                  followedTeamIds={followedTeamIds}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

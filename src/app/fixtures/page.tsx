import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { FixtureRow } from "@/components/fixture-row";
import { listFixtures } from "@/lib/data/repository";
import type { FixtureListItem } from "@/lib/data/types";
import { getFollowedTeamIds } from "@/lib/product/follows";
import { getCurrentUser } from "@/lib/supabase/server";

const RECENT_RESULTS_LIMIT = 12;
const RECENT_RESULTS_MAX_AGE_DAYS = 21;
const UPCOMING_HORIZON_DAYS = 45;

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

function hoursUntilKickoff(kickoffIso: string, now = Date.now()) {
  return (new Date(kickoffIso).getTime() - now) / (1000 * 60 * 60);
}

/** Drop stale demo "live/lineups" rows (e.g. August fixtures still marked live). */
function sanitizeFixture(fixture: FixtureListItem): FixtureListItem {
  const hours = hoursUntilKickoff(fixture.kickoff);
  if (
    (fixture.status === "live" || fixture.status === "lineups") &&
    hours < -6
  ) {
    return {
      ...fixture,
      status: "finished",
      lineupStatus: "unavailable",
    };
  }
  return fixture;
}

function inBoardWindow(fixture: FixtureListItem, now = Date.now()) {
  const hours = hoursUntilKickoff(fixture.kickoff, now);
  if (!Number.isFinite(hours)) return fixture.status === "scheduled";
  const days = hours / 24;
  if (fixture.status === "finished") {
    return days >= -RECENT_RESULTS_MAX_AGE_DAYS;
  }
  return days >= -0.5 && days <= UPCOMING_HORIZON_DAYS;
}

function hasOpenFixture(fixtures: FixtureListItem[]) {
  return fixtures.some(
    (f) =>
      f.status === "scheduled" ||
      f.status === "lineups" ||
      f.status === "live",
  );
}

export default async function FixturesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const listed = await listFixtures();
  let source = listed.source;
  let fixtures = listed.fixtures.map(sanitizeFixture).filter(inBoardWindow);

  // Guarantee a September board even if production DB is empty/stale
  if (!hasOpenFixture(fixtures)) {
    const { listSeedFixtures } = await import("@/lib/data/seed");
    const seed = listSeedFixtures().map(sanitizeFixture).filter(inBoardWindow);
    if (hasOpenFixture(seed)) {
      fixtures = seed;
      source = "seed";
    }
  }

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
    .filter((f) => {
      if (followedIds.has(f.id)) return false;
      const hours = hoursUntilKickoff(f.kickoff);
      // Only near-kickoff matches belong in this section
      if (hours < -4 || hours > 48) return false;
      return (
        f.status === "live" ||
        f.status === "lineups" ||
        f.lineupStatus === "confirmed" ||
        f.lineupStatus === "provisional"
      );
    })
    .sort(byKickoffAsc);

  const intelligenceIds = new Set(intelligenceReady.map((f) => f.id));

  const upcoming = fixtures
    .filter(
      (f) =>
        f.status === "scheduled" &&
        hoursUntilKickoff(f.kickoff) >= -0.5 &&
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
            No upcoming fixtures loaded. In Vercel → Settings → Environment
            Variables, set{" "}
            <code className="text-[var(--foreground)]">FOOTBALL_DATA_TOKEN</code>,{" "}
            <code className="text-[var(--foreground)]">FOOTBALL_SEASON=2026</code>, and{" "}
            <code className="text-[var(--foreground)]">CRON_SECRET</code>, redeploy,
            then open{" "}
            <code className="text-[var(--foreground)]">
              /api/sync?job=nightly
            </code>{" "}
            with header{" "}
            <code className="text-[var(--foreground)]">
              Authorization: Bearer &lt;CRON_SECRET&gt;
            </code>
            .
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
                  followedTeamIds={followedSet}
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
                  followedTeamIds={followedSet}
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
                  followedTeamIds={followedSet}
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
                  followedTeamIds={followedSet}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

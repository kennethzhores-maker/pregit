import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { FixtureRow } from "@/components/fixture-row";
import { listFixtures } from "@/lib/data/repository";
import { getFollowedTeamIds } from "@/lib/product/follows";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function FixturesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { fixtures, source } = await listFixtures();
  const followedTeamIds = await getFollowedTeamIds(user.id);
  const followedSet = new Set(followedTeamIds);

  const followedFixtures = fixtures.filter(
    (f) => followedSet.has(f.home.id) || followedSet.has(f.away.id),
  );
  const followedIds = new Set(followedFixtures.map((f) => f.id));

  const intelligenceReady = fixtures.filter(
    (f) =>
      !followedIds.has(f.id) &&
      (f.status === "live" ||
        f.status === "lineups" ||
        f.lineupStatus === "confirmed" ||
        f.lineupStatus === "provisional"),
  );
  const intelligenceIds = new Set(intelligenceReady.map((f) => f.id));
  const upcoming = fixtures.filter(
    (f) =>
      f.status === "scheduled" &&
      !intelligenceIds.has(f.id) &&
      !followedIds.has(f.id),
  );
  const finished = fixtures.filter(
    (f) => f.status === "finished" && !followedIds.has(f.id),
  );

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
              Open a match for form, confirmed or provisional XIs, absences, and
              season comparison — useful before any prediction model.
            </p>
          </div>
          <span className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Source: {source}
          </span>
        </div>

        {followedFixtures.length > 0 ? (
          <section className="rounded-xl border border-[var(--pitch)]/40 bg-[var(--panel)]/60">
            <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--pitch)]">
              Following
            </div>
            <div>
              {followedFixtures.map((fixture) => (
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
              followedFixtures.length > 0 ? "mt-8" : ""
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

        {finished.length > 0 ? (
          <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)]/60">
            <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Recent results
            </div>
            <div>
              {finished.map((fixture) => (
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

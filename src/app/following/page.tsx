import Link from "next/link";
import { redirect } from "next/navigation";

import { toggleFollowAction } from "@/app/following/actions";
import { AppHeader } from "@/components/app-header";
import { listFixtures } from "@/lib/data/repository";
import {
  getFollowedTeamIds,
  listFollowableTeams,
} from "@/lib/product/follows";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function FollowingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const followed = await getFollowedTeamIds(user.id);
  const teams = listFollowableTeams();
  const { fixtures } = await listFixtures();
  const followedSet = new Set(followed);

  const followedFixtures = fixtures.filter(
    (fixture) =>
      followedSet.has(fixture.home.id) || followedSet.has(fixture.away.id),
  );

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
            Following
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Track clubs you care about. Their fixtures surface first on matchdays.
          </p>
        </div>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 p-5">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Clubs
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {teams.map((team) => {
              const active = followedSet.has(team.id);
              return (
                <form
                  key={team.id}
                  action={toggleFollowAction}
                  className="flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2"
                >
                  <input type="hidden" name="teamId" value={team.id} />
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-xs text-[var(--muted)]">{team.shortName}</div>
                  </div>
                  <button
                    type="submit"
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      active
                        ? "bg-[var(--pitch)] text-[var(--pitch-ink)]"
                        : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--accent)]"
                    }`}
                  >
                    {active ? "Following" : "Follow"}
                  </button>
                </form>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)]/60">
          <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Your fixtures
          </div>
          {followedFixtures.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">
              Follow a club to pin their matches here.
            </p>
          ) : (
            <ul>
              {followedFixtures.map((fixture) => (
                <li key={fixture.id} className="border-b border-[var(--line)] px-4 py-3">
                  <Link
                    href={`/matches/${fixture.id}`}
                    className="flex items-center justify-between gap-3 text-sm hover:text-[var(--accent)]"
                  >
                    <span>
                      {fixture.home.name} vs {fixture.away.name}
                    </span>
                    <span className="text-[var(--muted)]">{fixture.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

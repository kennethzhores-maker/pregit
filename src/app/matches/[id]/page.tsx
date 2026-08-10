import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { FollowTeamButtons } from "@/components/follow-team-buttons";
import {
  HeadToHeadPanel,
  LineupBoard,
  SideFormPanel,
} from "@/components/lineup-board";
import { KeyAbsences, MatchHero } from "@/components/match-hero";
import { KickoffRefreshBar } from "@/components/kickoff-refresh-bar";
import { MatchInsights } from "@/components/match-insights";
import { PredictPanel } from "@/components/predict-panel";
import { StatComparisonBars } from "@/components/stat-comparison";
import {
  buildMatchInsights,
  buildStatComparisons,
  groupInjuriesByTeam,
} from "@/lib/data/intelligence";
import { getMatchDetail } from "@/lib/data/repository";
import { getFollowedTeamIds } from "@/lib/product/follows";
import { getCurrentUser } from "@/lib/supabase/server";

type MatchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const match = await getMatchDetail(id);
  if (!match) notFound();

  const insights = buildMatchInsights(match);
  const comparisons = buildStatComparisons(match.homeStats, match.awayStats);
  const absences = groupInjuriesByTeam(match);
  const followedTeamIds = await getFollowedTeamIds(user.id);

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/fixtures"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--accent)]"
          >
            ← Back to fixtures
          </Link>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Data: {match.dataSource}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          <MatchHero match={match} />

          <FollowTeamButtons
            homeId={match.home.id}
            awayId={match.away.id}
            homeName={match.home.shortName}
            awayName={match.away.shortName}
            followedTeamIds={followedTeamIds}
          />

          <KickoffRefreshBar
            fixtureId={match.id}
            lineupStatus={match.lineupStatus}
            homeXiCount={match.homeLineup.length}
            awayXiCount={match.awayLineup.length}
          />

          <MatchInsights insights={insights} />

          <div className="grid gap-4 lg:grid-cols-2">
            <LineupBoard
              title={`${match.home.name} XI`}
              players={match.homeLineup}
              lineupStatus={match.lineupStatus}
            />
            <LineupBoard
              title={`${match.away.name} XI`}
              players={match.awayLineup}
              lineupStatus={match.lineupStatus}
            />
          </div>

          <StatComparisonBars
            homeName={match.home.shortName}
            awayName={match.away.shortName}
            rows={comparisons}
          />

          <SideFormPanel
            homeName={match.home.name}
            awayName={match.away.name}
            homeForm={match.home.form}
            awayForm={match.away.form}
            homeHomeForm={match.homeStats?.homeForm ?? []}
            awayAwayForm={match.awayStats?.awayForm ?? []}
          />

          <KeyAbsences
            homeName={match.home.name}
            awayName={match.away.name}
            home={absences.home}
            away={absences.away}
          />

          <HeadToHeadPanel results={match.headToHead} />

          <PredictPanel
            fixtureId={match.id}
            homeName={match.home.name}
            awayName={match.away.name}
          />
        </div>
      </main>
    </>
  );
}

import { createClient } from "@/lib/supabase/server";
import { canUseSupabaseData } from "@/lib/supabase/admin";
import { getSeedMatchDetail, listSeedFixtures } from "@/lib/data/seed";
import {
  applyRefreshOverlay,
} from "@/lib/sync/pre-kickoff";
import type {
  FixtureListItem,
  FixtureStatus,
  MatchDetail,
  PlayerPosition,
} from "@/lib/data/types";
import { parseForm, resolveLineupStatus } from "@/lib/data/types";

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
};

type TeamStatsRow = {
  team_id: string;
  form: string | null;
  home_form?: string | null;
  away_form?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  season: number;
};

function mapTeamStats(row: TeamStatsRow | undefined, teamId: string) {
  if (!row) return null;
  const form = parseForm(row.form);
  return {
    teamId,
    season: row.season,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    form,
    homeForm: parseForm(row.home_form).length ? parseForm(row.home_form) : form,
    awayForm: parseForm(row.away_form).length ? parseForm(row.away_form) : form,
  };
}

export async function listFixtures(): Promise<{
  fixtures: FixtureListItem[];
  source: "supabase" | "seed";
}> {
  if (!canUseSupabaseData()) {
    const fixtures = listSeedFixtures().map((fixture) => {
      const refreshed = applyRefreshOverlay({
        ...getSeedMatchDetail(fixture.id)!,
      });
      return {
        ...fixture,
        status: refreshed.status,
        lineupStatus: refreshed.lineupStatus,
        home: refreshed.home,
        away: refreshed.away,
      };
    });
    return { fixtures, source: "seed" };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { fixtures: listSeedFixtures(), source: "seed" };
  }

  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select(
      `
      id,
      kickoff,
      venue,
      status,
      home_score,
      away_score,
      competition:competitions(name),
      home:teams!fixtures_home_team_id_fkey(id, name, short_name),
      away:teams!fixtures_away_team_id_fkey(id, name, short_name)
    `,
    )
    .order("kickoff", { ascending: true });

  if (error || !fixtures?.length) {
    return { fixtures: listSeedFixtures(), source: "seed" };
  }

  const teamIds = Array.from(
    new Set(
      fixtures.flatMap((f) => {
        const home = f.home as unknown as TeamRow | TeamRow[] | null;
        const away = f.away as unknown as TeamRow | TeamRow[] | null;
        const homeRow = Array.isArray(home) ? home[0] : home;
        const awayRow = Array.isArray(away) ? away[0] : away;
        return [homeRow?.id, awayRow?.id].filter(Boolean) as string[];
      }),
    ),
  );

  const fixtureIds = fixtures.map((f) => f.id as string);

  const [{ data: stats }, { data: lineupCounts }] = await Promise.all([
    supabase.from("team_stats").select("*").in("team_id", teamIds),
    supabase
      .from("lineups")
      .select("fixture_id, team_id")
      .in("fixture_id", fixtureIds),
  ]);

  const statsByTeam = new Map<string, TeamStatsRow>(
    (stats as TeamStatsRow[] | null)?.map((row) => [row.team_id, row]) ?? [],
  );

  const mapped: FixtureListItem[] = fixtures.map((fixture) => {
    const home = (
      Array.isArray(fixture.home) ? fixture.home[0] : fixture.home
    ) as TeamRow;
    const away = (
      Array.isArray(fixture.away) ? fixture.away[0] : fixture.away
    ) as TeamRow;
    const competition = Array.isArray(fixture.competition)
      ? fixture.competition[0]
      : fixture.competition;

    const related = (lineupCounts ?? []).filter(
      (row) => row.fixture_id === fixture.id,
    );
    const homeCount = related.filter((row) => row.team_id === home.id).length;
    const awayCount = related.filter((row) => row.team_id === away.id).length;

    return {
      id: fixture.id,
      competition: (competition as { name: string } | null)?.name ?? "League",
      kickoff: fixture.kickoff,
      venue: fixture.venue ?? "",
      status: fixture.status as FixtureStatus,
      home: {
        id: home.id,
        name: home.name,
        shortName: home.short_name,
        form: parseForm(statsByTeam.get(home.id)?.form),
      },
      away: {
        id: away.id,
        name: away.name,
        shortName: away.short_name,
        form: parseForm(statsByTeam.get(away.id)?.form),
      },
      homeScore: fixture.home_score,
      awayScore: fixture.away_score,
      lineupStatus: resolveLineupStatus(
        fixture.status as FixtureStatus,
        homeCount,
        awayCount,
      ),
    };
  });

  return { fixtures: mapped, source: "supabase" };
}

export async function getMatchDetail(
  id: string,
): Promise<MatchDetail | null> {
  if (!canUseSupabaseData()) {
    const seed = getSeedMatchDetail(id);
    return seed ? applyRefreshOverlay(seed) : null;
  }

  const supabase = await createClient();
  if (!supabase) {
    const seed = getSeedMatchDetail(id);
    return seed ? applyRefreshOverlay(seed) : null;
  }

  const { data: fixture, error } = await supabase
    .from("fixtures")
    .select(
      `
      id,
      kickoff,
      venue,
      status,
      home_score,
      away_score,
      referee,
      round,
      home_team_id,
      away_team_id,
      competition:competitions(name),
      home:teams!fixtures_home_team_id_fkey(id, name, short_name),
      away:teams!fixtures_away_team_id_fkey(id, name, short_name)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !fixture) {
    const seed = getSeedMatchDetail(id);
    return seed ? applyRefreshOverlay(seed) : null;
  }

  const home = (
    Array.isArray(fixture.home) ? fixture.home[0] : fixture.home
  ) as TeamRow;
  const away = (
    Array.isArray(fixture.away) ? fixture.away[0] : fixture.away
  ) as TeamRow;
  const competition = Array.isArray(fixture.competition)
    ? fixture.competition[0]
    : fixture.competition;

  const [
    { data: lineupRows },
    { data: injuryRows },
    { data: teamStats },
    { data: h2hRows },
  ] = await Promise.all([
    supabase
      .from("lineups")
      .select(
        `
          team_id,
          player_id,
          is_starter,
          position,
          shirt_number,
          player:players(name)
        `,
      )
      .eq("fixture_id", id),
    supabase
      .from("injuries")
      .select(
        `
          id,
          player_id,
          team_id,
          injury_type,
          reason,
          is_active,
          player:players(name)
        `,
      )
      .eq("is_active", true)
      .in("team_id", [fixture.home_team_id, fixture.away_team_id]),
    supabase
      .from("team_stats")
      .select("*")
      .in("team_id", [fixture.home_team_id, fixture.away_team_id]),
    supabase
      .from("fixtures")
      .select(
        `
          id,
          kickoff,
          home_score,
          away_score,
          home:teams!fixtures_home_team_id_fkey(name),
          away:teams!fixtures_away_team_id_fkey(name)
        `,
      )
      .eq("status", "finished")
      .neq("id", id)
      .or(
        `and(home_team_id.eq.${fixture.home_team_id},away_team_id.eq.${fixture.away_team_id}),and(home_team_id.eq.${fixture.away_team_id},away_team_id.eq.${fixture.home_team_id})`,
      )
      .order("kickoff", { ascending: false })
      .limit(5),
  ]);

  const playerIds = (lineupRows ?? []).map((row) => row.player_id as string);
  const { data: playerStats } = playerIds.length
    ? await supabase.from("player_stats").select("*").in("player_id", playerIds)
    : { data: [] as Array<Record<string, unknown>> };

  const statsByPlayer = new Map(
    (playerStats ?? []).map((row) => [row.player_id as string, row]),
  );

  const mapLineup = (teamId: string) =>
    (lineupRows ?? [])
      .filter((row) => row.team_id === teamId && row.is_starter)
      .map((row) => {
        const player = Array.isArray(row.player) ? row.player[0] : row.player;
        const statsRaw = statsByPlayer.get(row.player_id as string);
        return {
          playerId: row.player_id,
          teamId: row.team_id,
          playerName: (player as { name: string } | null)?.name ?? "Unknown",
          isStarter: row.is_starter,
          position: (row.position as PlayerPosition | null) ?? null,
          shirtNumber: row.shirt_number,
          rating: (statsRaw?.rating as number | null) ?? null,
          goals: (statsRaw?.goals as number) ?? 0,
          assists: (statsRaw?.assists as number) ?? 0,
        };
      });

  const statsByTeam = new Map(
    (teamStats as TeamStatsRow[] | null)?.map((row) => [row.team_id, row]) ??
      [],
  );

  const homeLineup = mapLineup(fixture.home_team_id);
  const awayLineup = mapLineup(fixture.away_team_id);

  const detail: MatchDetail = {
    id: fixture.id,
    competition: (competition as { name: string } | null)?.name ?? "League",
    kickoff: fixture.kickoff,
    venue: fixture.venue ?? "",
    status: fixture.status as FixtureStatus,
    home: {
      id: home.id,
      name: home.name,
      shortName: home.short_name,
      form: parseForm(statsByTeam.get(home.id)?.form),
    },
    away: {
      id: away.id,
      name: away.name,
      shortName: away.short_name,
      form: parseForm(statsByTeam.get(away.id)?.form),
    },
    homeScore: fixture.home_score,
    awayScore: fixture.away_score,
    referee: fixture.referee,
    round: fixture.round,
    homeLineup,
    awayLineup,
    injuries: (injuryRows ?? []).map((row) => {
      const player = Array.isArray(row.player) ? row.player[0] : row.player;
      return {
        id: row.id,
        playerId: row.player_id,
        teamId: row.team_id,
        playerName: (player as { name: string } | null)?.name ?? "Unknown",
        injuryType: row.injury_type,
        reason: row.reason,
        isActive: row.is_active,
      };
    }),
    homeStats: mapTeamStats(
      statsByTeam.get(fixture.home_team_id),
      fixture.home_team_id,
    ),
    awayStats: mapTeamStats(
      statsByTeam.get(fixture.away_team_id),
      fixture.away_team_id,
    ),
    headToHead: (h2hRows ?? [])
      .filter((row) => row.home_score != null && row.away_score != null)
      .map((row) => {
        const h = Array.isArray(row.home) ? row.home[0] : row.home;
        const a = Array.isArray(row.away) ? row.away[0] : row.away;
        return {
          id: row.id,
          kickoff: row.kickoff,
          homeName: (h as { name: string } | null)?.name ?? "Home",
          awayName: (a as { name: string } | null)?.name ?? "Away",
          homeScore: row.home_score as number,
          awayScore: row.away_score as number,
        };
      }),
    lineupStatus: resolveLineupStatus(
      fixture.status as FixtureStatus,
      homeLineup.length,
      awayLineup.length,
    ),
    dataSource: "supabase",
  };

  return applyRefreshOverlay(detail);
}

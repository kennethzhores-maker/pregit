import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COMPETITION,
  FIXTURES,
  INJURIES,
  LINEUPS,
  PLAYERS,
  PLAYER_STATS,
  SEASON,
  TEAMS,
  TEAM_STATS,
} from "@/lib/data/seed";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  recordSquadSync,
  syncPremierLeagueSquads,
} from "@/lib/sync/sync-squads";
import { syncPremierLeagueTeamStats } from "@/lib/sync/sync-team-stats";

export type SyncJob = "seed" | "hourly" | "nightly" | "squads";

export type SyncResult = {
  job: SyncJob;
  status: "success" | "failed" | "skipped";
  recordsUpserted: number;
  message: string;
  source: "seed" | "api-football";
};

async function recordSyncRun(
  supabase: SupabaseClient,
  job: SyncJob,
  result: Omit<SyncResult, "job">,
) {
  await supabase.from("sync_runs").insert({
    job_name: job,
    status: result.status === "success" ? "success" : "failed",
    finished_at: new Date().toISOString(),
    records_upserted: result.recordsUpserted,
    error: result.status === "failed" ? result.message : null,
    meta: { source: result.source, message: result.message },
  });
}

export async function seedDatabase(): Promise<SyncResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      job: "seed",
      status: "skipped",
      recordsUpserted: 0,
      message:
        "SUPABASE_SERVICE_ROLE_KEY not set. App will use local seed data.",
      source: "seed",
    };
  }

  let records = 0;

  try {
    const { error: competitionError } = await supabase
      .from("competitions")
      .upsert({
        id: COMPETITION.id,
        external_id: COMPETITION.externalId,
        name: COMPETITION.name,
        country: COMPETITION.country,
        season: COMPETITION.season,
      });
    if (competitionError) throw competitionError;
    records += 1;

    const { error: teamsError } = await supabase.from("teams").upsert(
      TEAMS.map((team) => ({
        id: team.id,
        external_id: team.externalId,
        competition_id: team.competitionId,
        name: team.name,
        short_name: team.shortName,
        tla: team.tla,
        crest_url: team.crestUrl,
        venue: team.venue,
      })),
    );
    if (teamsError) throw teamsError;
    records += TEAMS.length;

    const { error: playersError } = await supabase.from("players").upsert(
      PLAYERS.map((player) => ({
        id: player.id,
        external_id: player.externalId,
        team_id: player.teamId,
        name: player.name,
        position: player.position,
        shirt_number: player.shirtNumber,
        nationality: player.nationality,
      })),
    );
    if (playersError) throw playersError;
    records += PLAYERS.length;

    const { error: fixturesError } = await supabase.from("fixtures").upsert(
      FIXTURES.map((fixture) => ({
        id: fixture.id,
        external_id: fixture.externalId,
        competition_id: fixture.competitionId,
        home_team_id: fixture.homeTeamId,
        away_team_id: fixture.awayTeamId,
        kickoff: fixture.kickoff,
        venue: fixture.venue,
        status: fixture.status,
        home_score: fixture.homeScore,
        away_score: fixture.awayScore,
        referee: fixture.referee,
        round: fixture.round,
      })),
    );
    if (fixturesError) throw fixturesError;
    records += FIXTURES.length;

    const { error: teamStatsError } = await supabase.from("team_stats").upsert(
      TEAM_STATS.map((stats) => ({
        team_id: stats.teamId,
        season: stats.season,
        played: stats.played,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        goals_for: stats.goalsFor,
        goals_against: stats.goalsAgainst,
        form: stats.form.join(""),
        home_form: stats.homeForm.join(""),
        away_form: stats.awayForm.join(""),
      })),
      { onConflict: "team_id,season" },
    );
    if (teamStatsError) throw teamStatsError;
    records += TEAM_STATS.length;

    const { error: playerStatsError } = await supabase
      .from("player_stats")
      .upsert(
        PLAYER_STATS.map((stats) => ({
          player_id: stats.playerId,
          season: stats.season,
          appearances: stats.appearances,
          minutes: stats.minutes,
          goals: stats.goals,
          assists: stats.assists,
          yellow_cards: stats.yellowCards,
          red_cards: stats.redCards,
          rating: stats.rating,
        })),
        { onConflict: "player_id,season" },
      );
    if (playerStatsError) throw playerStatsError;
    records += PLAYER_STATS.length;

    // Replace lineups for seeded fixtures
    const lineupFixtureIds = Object.keys(LINEUPS);
    if (lineupFixtureIds.length) {
      await supabase.from("lineups").delete().in("fixture_id", lineupFixtureIds);
    }

    const lineupRows = Object.entries(LINEUPS).flatMap(([fixtureId, sides]) =>
      [...sides.home, ...sides.away].map((entry) => ({
        fixture_id: fixtureId,
        team_id: entry.teamId,
        player_id: entry.playerId,
        is_starter: entry.isStarter,
        position: entry.position,
        shirt_number: entry.shirtNumber,
      })),
    );

    if (lineupRows.length) {
      const { error: lineupError } = await supabase
        .from("lineups")
        .insert(lineupRows);
      if (lineupError) throw lineupError;
      records += lineupRows.length;
    }

    await supabase.from("injuries").delete().neq("id", "");
    const { error: injuriesError } = await supabase.from("injuries").insert(
      INJURIES.map((injury) => ({
        id: injury.id,
        player_id: injury.playerId,
        team_id: injury.teamId,
        injury_type: injury.injuryType,
        reason: injury.reason,
        is_active: injury.isActive,
      })),
    );
    if (injuriesError) throw injuriesError;
    records += INJURIES.length;

    const result: SyncResult = {
      job: "seed",
      status: "success",
      recordsUpserted: records,
      message: `Seeded Premier League sample for season ${SEASON}.`,
      source: "seed",
    };
    await recordSyncRun(supabase, "seed", result);
    return result;
  } catch (error) {
    const result: SyncResult = {
      job: "seed",
      status: "failed",
      recordsUpserted: records,
      message: error instanceof Error ? error.message : "Seed failed",
      source: "seed",
    };
    await recordSyncRun(supabase, "seed", result);
    return result;
  }
}

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    venue?: { name?: string };
    status: { short: string };
    referee?: string | null;
  };
  league: { round?: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};

function mapApiStatus(short: string): string {
  switch (short) {
    case "NS":
    case "TBD":
      return "scheduled";
    case "1H":
    case "2H":
    case "HT":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
      return "live";
    case "FT":
    case "AET":
    case "PEN":
      return "finished";
    case "PST":
      return "postponed";
    case "CANC":
      return "cancelled";
    default:
      return "scheduled";
  }
}

async function syncFromApiFootball(job: SyncJob): Promise<SyncResult> {
  const supabase = createServiceClient();
  const apiKey = process.env.FOOTBALL_API_KEY;

  if (!supabase) {
    return {
      job,
      status: "skipped",
      recordsUpserted: 0,
      message: "SUPABASE_SERVICE_ROLE_KEY not set.",
      source: "api-football",
    };
  }

  if (!apiKey) {
    // No live API key yet — keep DB fresh from seed package
    const seeded = await seedDatabase();
    return {
      ...seeded,
      job,
      message: `FOOTBALL_API_KEY missing; ran seed fallback. ${seeded.message}`,
    };
  }

  const leagueId = process.env.FOOTBALL_LEAGUE_ID ?? "39";
  const season = process.env.FOOTBALL_SEASON ?? String(SEASON);
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", leagueId);
  url.searchParams.set("season", season);

  if (job === "hourly") {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 3);
    url.searchParams.set("from", from.toISOString().slice(0, 10));
    url.searchParams.set("to", to.toISOString().slice(0, 10));
  }

  try {
    const response = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`API-Football HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      response?: ApiFootballFixture[];
      errors?: unknown;
    };

    const apiErrors = payload.errors;
    const hasApiError =
      apiErrors != null &&
      (Array.isArray(apiErrors)
        ? apiErrors.length > 0
        : typeof apiErrors === "object" && Object.keys(apiErrors).length > 0);

    if (hasApiError) {
      const message =
        typeof apiErrors === "object"
          ? JSON.stringify(apiErrors)
          : String(apiErrors);
      const result: SyncResult = {
        job,
        status: "failed",
        recordsUpserted: 0,
        message: `API-Football rejected the request: ${message}`,
        source: "api-football",
      };
      await recordSyncRun(supabase, job, result);
      return result;
    }

    const rows = payload.response ?? [];
    let records = 0;

    // Ensure competition exists
    await supabase.from("competitions").upsert({
      id: "pl",
      external_id: leagueId,
      name: "Premier League",
      country: "England",
      season: Number(season),
    });

    for (const row of rows) {
      const homeId = `api-team-${row.teams.home.id}`;
      const awayId = `api-team-${row.teams.away.id}`;

      await supabase.from("teams").upsert([
        {
          id: homeId,
          external_id: String(row.teams.home.id),
          competition_id: "pl",
          name: row.teams.home.name,
          short_name: row.teams.home.name.slice(0, 3).toUpperCase(),
          venue: null,
        },
        {
          id: awayId,
          external_id: String(row.teams.away.id),
          competition_id: "pl",
          name: row.teams.away.name,
          short_name: row.teams.away.name.slice(0, 3).toUpperCase(),
          venue: null,
        },
      ]);
      records += 2;

      const fixtureId = `api-fx-${row.fixture.id}`;
      await supabase.from("fixtures").upsert({
        id: fixtureId,
        external_id: String(row.fixture.id),
        competition_id: "pl",
        home_team_id: homeId,
        away_team_id: awayId,
        kickoff: row.fixture.date,
        venue: row.fixture.venue?.name ?? null,
        status: mapApiStatus(row.fixture.status.short),
        home_score: row.goals.home,
        away_score: row.goals.away,
        referee: row.fixture.referee ?? null,
        round: row.league.round ?? null,
      });
      records += 1;
    }

    const result: SyncResult = {
      job,
      status: "success",
      recordsUpserted: records,
      message: `Synced ${rows.length} fixtures from API-Football.`,
      source: "api-football",
    };
    await recordSyncRun(supabase, job, result);
    return result;
  } catch (error) {
    const result: SyncResult = {
      job,
      status: "failed",
      recordsUpserted: 0,
      message: error instanceof Error ? error.message : "API sync failed",
      source: "api-football",
    };
    await recordSyncRun(supabase, job, result);
    return result;
  }
}

export async function runSync(job: SyncJob = "hourly"): Promise<SyncResult> {
  if (job === "seed") {
    return seedDatabase();
  }

  if (job === "squads") {
    const supabase = createServiceClient();
    const teamStats = await syncPremierLeagueTeamStats();
    const squadResult = await syncPremierLeagueSquads();
    if (supabase) {
      await recordSquadSync(supabase, {
        ...squadResult,
        message: `${teamStats.message} ${squadResult.message}`,
      });
    }
    return {
      job: "squads",
      status:
        squadResult.status === "failed" || teamStats.status === "failed"
          ? "failed"
          : squadResult.status === "skipped" && teamStats.status === "skipped"
            ? "skipped"
            : "success",
      recordsUpserted:
        squadResult.players + squadResult.stats + teamStats.teams,
      message: `${teamStats.message} ${squadResult.message}`,
      source: "api-football",
    };
  }

  return syncFromApiFootball(job);
}

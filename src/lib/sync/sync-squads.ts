import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/admin";

type ApiTeam = {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string | null;
    founded: number | null;
    national: boolean;
    logo: string | null;
  };
  venue: { name: string | null } | null;
};

type ApiSquadPlayer = {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
};

type ApiPlayerStatsRow = {
  player: {
    id: number;
    name: string;
    nationality: string | null;
  };
  statistics: Array<{
    team: { id: number };
    league: { id: number; name: string };
    games: {
      appearences: number | null;
      minutes: number | null;
      position: string | null;
      rating: string | null;
    };
    goals: {
      total: number | null;
      assists: number | null;
    };
    cards: {
      yellow: number | null;
      red: number | null;
    };
  }>;
};

function mapPosition(raw: string | null): "GK" | "DF" | "MF" | "FW" {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("goal")) return "GK";
  if (value.includes("def") || value.includes("back")) return "DF";
  if (value.includes("attack") || value.includes("forward") || value === "fw")
    return "FW";
  return "MF";
}

function teamRowId(apiTeamId: number) {
  return `api-team-${apiTeamId}`;
}

function playerRowId(apiPlayerId: number) {
  return `api-player-${apiPlayerId}`;
}

async function apiGet<T>(
  path: string,
  apiKey: string,
  params: Record<string, string>,
): Promise<{ response: T[]; errors: unknown; paging?: { current: number; total: number } }> {
  // Free plan rate limit ~10 req/min
  await new Promise((resolve) => setTimeout(resolve, 6500));

  const url = new URL(`https://v3.football.api-sports.io${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`API-Football HTTP ${response.status} on ${path}`);
  }
  return (await response.json()) as {
    response: T[];
    errors: unknown;
    paging?: { current: number; total: number };
  };
}

function hasErrors(errors: unknown) {
  if (errors == null) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return Boolean(errors);
}

export type SquadSyncResult = {
  status: "success" | "failed" | "skipped";
  teams: number;
  players: number;
  stats: number;
  message: string;
};

/**
 * Pull current PL squads + season stats into Supabase.
 * Uses team id `api-team-{id}` / player id `api-player-{id}`.
 */
export async function syncPremierLeagueSquads(): Promise<SquadSyncResult> {
  const supabase = createServiceClient();
  const apiKey = process.env.FOOTBALL_API_KEY;
  const leagueId = process.env.FOOTBALL_LEAGUE_ID ?? "39";
  const season = process.env.FOOTBALL_SEASON ?? "2024";

  if (!supabase) {
    return {
      status: "skipped",
      teams: 0,
      players: 0,
      stats: 0,
      message: "SUPABASE_SERVICE_ROLE_KEY not set.",
    };
  }
  if (!apiKey) {
    return {
      status: "skipped",
      teams: 0,
      players: 0,
      stats: 0,
      message: "FOOTBALL_API_KEY missing.",
    };
  }

  try {
    await supabase.from("competitions").upsert({
      id: "pl",
      external_id: leagueId,
      name: "Premier League",
      country: "England",
      season: Number(season),
    });

    const teamsPayload = await apiGet<ApiTeam>(
      "/teams",
      apiKey,
      { league: leagueId, season },
    );
    if (hasErrors(teamsPayload.errors)) {
      throw new Error(`Teams error: ${JSON.stringify(teamsPayload.errors)}`);
    }

    const apiTeams = teamsPayload.response ?? [];
    let playerCount = 0;
    let statsCount = 0;

    for (const row of apiTeams) {
      const tid = teamRowId(row.team.id);
      await supabase.from("teams").upsert({
        id: tid,
        external_id: String(row.team.id),
        competition_id: "pl",
        name: row.team.name,
        short_name: (row.team.code ?? row.team.name.slice(0, 3)).toUpperCase(),
        crest_url: row.team.logo,
        venue: row.venue?.name ?? null,
      });

      const squadPayload = await apiGet<{
        team: { id: number };
        players: ApiSquadPlayer[];
      }>("/players/squads", apiKey, { team: String(row.team.id) });

      if (hasErrors(squadPayload.errors)) {
        continue;
      }

      const squad = squadPayload.response?.[0]?.players ?? [];
      const liveExternalIds = new Set(squad.map((p) => String(p.id)));

      // Drop players no longer at this club (transfers)
      const { data: existing } = await supabase
        .from("players")
        .select("id, external_id")
        .eq("team_id", tid);

      const staleIds =
        existing
          ?.filter(
            (p) =>
              p.external_id &&
              !liveExternalIds.has(String(p.external_id)),
          )
          .map((p) => p.id) ?? [];

      if (staleIds.length) {
        // Clear dependent rows that block player delete, then remove stale players
        await supabase.from("lineups").delete().in("player_id", staleIds);
        await supabase.from("player_stats").delete().in("player_id", staleIds);
        await supabase.from("injuries").delete().in("player_id", staleIds);
        await supabase.from("players").delete().in("id", staleIds);
      }

      if (squad.length) {
        await supabase.from("players").upsert(
          squad.map((player) => ({
            id: playerRowId(player.id),
            external_id: String(player.id),
            team_id: tid,
            name: player.name,
            position: mapPosition(player.position),
            shirt_number: player.number,
            nationality: null,
          })),
        );
        playerCount += squad.length;
      }

      // Season stats (paginate, capped for free-plan quota)
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= 2) {
        const statsPayload = await apiGet<ApiPlayerStatsRow>(
          "/players",
          apiKey,
          {
            team: String(row.team.id),
            season,
            page: String(page),
          },
        );
        if (hasErrors(statsPayload.errors)) break;
        totalPages = statsPayload.paging?.total ?? 1;

        for (const entry of statsPayload.response ?? []) {
          const plStats =
            entry.statistics.find((s) => s.league.id === Number(leagueId)) ??
            entry.statistics[0];
          if (!plStats) continue;

          // Keep roster accurate: only store stats if player is on current squad
          // or update team_id from stats team when present on squad list
          const pid = playerRowId(entry.player.id);
          const onSquad = liveExternalIds.has(String(entry.player.id));
          if (!onSquad) continue;

          await supabase.from("players").upsert({
            id: pid,
            external_id: String(entry.player.id),
            team_id: tid,
            name: entry.player.name,
            position: mapPosition(plStats.games.position),
            nationality: entry.player.nationality,
          });

          await supabase.from("player_stats").upsert(
            {
              player_id: pid,
              season: Number(season),
              appearances: plStats.games.appearences ?? 0,
              minutes: plStats.games.minutes ?? 0,
              goals: plStats.goals.total ?? 0,
              assists: plStats.goals.assists ?? 0,
              yellow_cards: plStats.cards.yellow ?? 0,
              red_cards: plStats.cards.red ?? 0,
              rating: plStats.games.rating
                ? Number(plStats.games.rating)
                : null,
            },
            { onConflict: "player_id,season" },
          );
          statsCount += 1;
        }

        page += 1;
      }
    }

    return {
      status: "success",
      teams: apiTeams.length,
      players: playerCount,
      stats: statsCount,
      message: `Synced ${apiTeams.length} PL squads (${playerCount} players, ${statsCount} stat rows) for season ${season}.`,
    };
  } catch (error) {
    return {
      status: "failed",
      teams: 0,
      players: 0,
      stats: 0,
      message: error instanceof Error ? error.message : "Squad sync failed",
    };
  }
}

export async function recordSquadSync(
  supabase: SupabaseClient,
  result: SquadSyncResult,
) {
  await supabase.from("sync_runs").insert({
    job_name: "squads",
    status: result.status === "success" ? "success" : "failed",
    finished_at: new Date().toISOString(),
    records_upserted: result.players + result.stats,
    error: result.status === "failed" ? result.message : null,
    meta: result,
  });
}

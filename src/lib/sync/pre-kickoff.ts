import type {
  FixtureStatus,
  Injury,
  LineupEntry,
  LineupStatus,
  MatchDetail,
  PlayerPosition,
} from "@/lib/data/types";
import { parseForm, resolveLineupStatus } from "@/lib/data/types";
import {
  FIXTURES,
  INJURIES,
  LINEUPS,
  PLAYERS,
  PLAYER_STATS,
  getSeedMatchDetail,
} from "@/lib/data/seed";
import { createServiceClient } from "@/lib/supabase/admin";

export type RefreshSource = "seed" | "api-football" | "cache" | "squad";

export type MatchRefreshResult = {
  fixtureId: string;
  refreshedAt: string;
  source: RefreshSource;
  lineupStatus: LineupStatus;
  homeXiCount: number;
  awayXiCount: number;
  injuryCount: number;
  hoursToKickoff: number | null;
  notes: string[];
  changed: boolean;
};

type RefreshOverlay = {
  refreshedAt: string;
  source: RefreshSource;
  status?: FixtureStatus;
  homeLineup?: LineupEntry[];
  awayLineup?: LineupEntry[];
  injuries?: Injury[];
  notes: string[];
};

const refreshStore = new Map<string, RefreshOverlay>();
const CACHE_MS_FAR = 5 * 60 * 1000;
const CACHE_MS_NEAR = 90 * 1000;
const NEAR_KICKOFF_HOURS = 6;
const CONFIRM_WINDOW_HOURS = 1.5;

function hoursUntil(kickoffIso: string): number {
  return (new Date(kickoffIso).getTime() - Date.now()) / (1000 * 60 * 60);
}

function mapPos(pos: string): PlayerPosition {
  const p = pos.toUpperCase();
  if (p === "G" || p.includes("GK") || p.includes("GOAL")) return "GK";
  if (p === "D" || p.includes("DEF") || p.includes("BACK")) return "DF";
  if (p === "M" || p.includes("MID")) return "MF";
  return "FW";
}

function buildSquadXi(teamId: string): LineupEntry[] {
  const injured = new Set(
    INJURIES.filter((i) => i.isActive && i.teamId === teamId).map(
      (i) => i.playerId,
    ),
  );
  const available = PLAYERS.filter(
    (p) => p.teamId === teamId && !injured.has(p.id),
  );
  const stats = new Map(PLAYER_STATS.map((s) => [s.playerId, s]));

  const pick = (position: PlayerPosition, count: number) =>
    available
      .filter((p) => p.position === position)
      .sort(
        (a, b) =>
          (stats.get(b.id)?.rating ?? 0) - (stats.get(a.id)?.rating ?? 0),
      )
      .slice(0, count);

  const selected = [
    ...pick("GK", 1),
    ...pick("DF", 4),
    ...pick("MF", 3),
    ...pick("FW", 3),
  ].slice(0, 11);

  return selected.map((player) => {
    const row = stats.get(player.id);
    return {
      playerId: player.id,
      teamId,
      playerName: player.name,
      isStarter: true,
      position: player.position,
      shirtNumber: player.shirtNumber,
      rating: row?.rating ?? null,
      goals: row?.goals ?? 0,
      assists: row?.assists ?? 0,
    };
  });
}

async function buildSquadXiFromDb(teamId: string): Promise<LineupEntry[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data: players } = await supabase
    .from("players")
    .select("id, name, position, shirt_number")
    .eq("team_id", teamId);

  if (!players?.length) return [];

  const ids = players.map((p) => p.id);
  const { data: statsRows } = await supabase
    .from("player_stats")
    .select("player_id, rating, goals, assists")
    .in("player_id", ids);

  const stats = new Map(
    (statsRows ?? []).map((s) => [s.player_id as string, s]),
  );

  const ranked = [...players].sort((a, b) => {
    const ra = Number(stats.get(a.id)?.rating ?? 6.4);
    const rb = Number(stats.get(b.id)?.rating ?? 6.4);
    return rb - ra;
  });

  const pick = (position: PlayerPosition, count: number) =>
    ranked
      .filter((p) => mapPos(String(p.position ?? "MF")) === position)
      .slice(0, count);

  const selected = [
    ...pick("GK", 1),
    ...pick("DF", 4),
    ...pick("MF", 3),
    ...pick("FW", 3),
  ];

  if (selected.length < 11) {
    for (const player of ranked) {
      if (selected.length >= 11) break;
      if (!selected.some((s) => s.id === player.id)) selected.push(player);
    }
  }

  return selected.slice(0, 11).map((player) => {
    const row = stats.get(player.id);
    return {
      playerId: player.id,
      teamId,
      playerName: player.name,
      isStarter: true,
      position: mapPos(String(player.position ?? "MF")),
      shirtNumber: player.shirt_number,
      rating: row?.rating != null ? Number(row.rating) : null,
      goals: Number(row?.goals ?? 0),
      assists: Number(row?.assists ?? 0),
    };
  });
}

async function enrichLineupStats(lineup: LineupEntry[]): Promise<LineupEntry[]> {
  const supabase = createServiceClient();
  if (!supabase || !lineup.length) return lineup;

  const ids = lineup.map((p) => p.playerId);
  const { data: statsRows } = await supabase
    .from("player_stats")
    .select("player_id, rating, goals, assists")
    .in("player_id", ids);

  const stats = new Map(
    (statsRows ?? []).map((s) => [s.player_id as string, s]),
  );

  return lineup.map((entry) => {
    const row = stats.get(entry.playerId);
    if (!row) return entry;
    return {
      ...entry,
      rating: row.rating != null ? Number(row.rating) : entry.rating,
      goals: Number(row.goals ?? entry.goals),
      assists: Number(row.assists ?? entry.assists),
    };
  });
}

function sameLineup(a: LineupEntry[] = [], b: LineupEntry[] = []) {
  if (a.length !== b.length) return false;
  return a.every((player, index) => player.playerId === b[index]?.playerId);
}

export function getRefreshOverlay(fixtureId: string): RefreshOverlay | null {
  return refreshStore.get(fixtureId) ?? null;
}

export function applyRefreshOverlay(match: MatchDetail): MatchDetail {
  const overlay = refreshStore.get(match.id);
  if (!overlay) return match;

  const homeLineup = overlay.homeLineup ?? match.homeLineup;
  const awayLineup = overlay.awayLineup ?? match.awayLineup;
  const status = overlay.status ?? match.status;
  const injuries = overlay.injuries ?? match.injuries;

  return {
    ...match,
    status,
    homeLineup,
    awayLineup,
    injuries,
    lineupStatus: resolveLineupStatus(
      status,
      homeLineup.length,
      awayLineup.length,
    ),
  };
}

async function resolveExternalFixtureId(fixtureId: string): Promise<string | null> {
  const seed = FIXTURES.find((f) => f.id === fixtureId)?.externalId ?? null;
  const supabase = createServiceClient();
  if (!supabase) return seed;

  const { data } = await supabase
    .from("fixtures")
    .select("external_id")
    .eq("id", fixtureId)
    .maybeSingle();

  return (data?.external_id as string | null) ?? seed;
}

async function refreshInjuriesFromApi(
  homeTeamExternalId: string,
  awayTeamExternalId: string,
): Promise<Injury[]> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) return [];

  const injuries: Injury[] = [];
  for (const teamExt of [homeTeamExternalId, awayTeamExternalId]) {
    try {
      const response = await fetch(
        `https://v3.football.api-sports.io/injuries?team=${teamExt}&season=${process.env.FOOTBALL_SEASON ?? "2024"}`,
        {
          headers: { "x-apisports-key": apiKey },
          cache: "no-store",
        },
      );
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        response?: Array<{
          player: { id: number; name: string };
          team: { id: number };
          fixture?: { id: number };
          reason?: string;
          type?: string;
        }>;
      };

      for (const row of (payload.response ?? []).slice(0, 40)) {
        injuries.push({
          id: `api-inj-${row.player.id}-${row.team.id}`,
          playerId: `api-player-${row.player.id}`,
          teamId: `api-team-${row.team.id}`,
          playerName: row.player.name,
          injuryType: row.type ?? null,
          reason: row.reason ?? null,
          isActive: true,
        });
      }
    } catch {
      // ignore team injury failures
    }
  }
  return injuries;
}

async function refreshFromApiFootball(
  fixtureId: string,
  externalId: string | null,
  homeTeamId: string,
  awayTeamId: string,
): Promise<RefreshOverlay | null> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey || !externalId) return null;

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/lineups?fixture=${externalId}`,
      {
        headers: { "x-apisports-key": apiKey },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      response?: Array<{
        team: { id: number };
        startXI?: Array<{
          player: { id: number; name: string; number: number; pos: string };
        }>;
      }>;
      errors?: unknown;
    };

    const rows = payload.response ?? [];
    if (rows.length < 2) return null;

    const toLineup = (
      teamId: string,
      startXI: Array<{
        player: { id: number; name: string; number: number; pos: string };
      }>,
    ): LineupEntry[] =>
      startXI.slice(0, 11).map((row) => ({
        playerId: `api-player-${row.player.id}`,
        teamId,
        playerName: row.player.name,
        isStarter: true,
        position: mapPos(row.player.pos),
        shirtNumber: row.player.number,
        rating: null,
        goals: 0,
        assists: 0,
      }));

    let homeLineup = toLineup(homeTeamId, rows[0].startXI ?? []);
    let awayLineup = toLineup(awayTeamId, rows[1].startXI ?? []);
    if (homeLineup.length < 11 || awayLineup.length < 11) return null;

    homeLineup = await enrichLineupStats(homeLineup);
    awayLineup = await enrichLineupStats(awayLineup);

    const homeExt = homeTeamId.replace("api-team-", "");
    const awayExt = awayTeamId.replace("api-team-", "");
    const injuries = await refreshInjuriesFromApi(homeExt, awayExt);

    const supabase = createServiceClient();
    if (supabase) {
      // Ensure players exist so lineup FK inserts succeed
      await supabase.from("players").upsert(
        [...homeLineup, ...awayLineup].map((entry) => ({
          id: entry.playerId,
          external_id: entry.playerId.replace("api-player-", ""),
          team_id: entry.teamId,
          name: entry.playerName,
          position: entry.position,
          shirt_number: entry.shirtNumber,
        })),
      );
      await supabase.from("lineups").delete().eq("fixture_id", fixtureId);
      await supabase.from("lineups").insert(
        [...homeLineup, ...awayLineup].map((entry) => ({
          fixture_id: fixtureId,
          team_id: entry.teamId,
          player_id: entry.playerId,
          is_starter: true,
          position: entry.position,
          shirt_number: entry.shirtNumber,
        })),
      );
      if (injuries.length) {
        await supabase.from("injuries").upsert(
          injuries.map((injury) => ({
            id: injury.id,
            player_id: injury.playerId,
            team_id: injury.teamId,
            injury_type: injury.injuryType,
            reason: injury.reason,
            is_active: true,
          })),
        );
      }
      await supabase
        .from("fixtures")
        .update({
          status: "lineups",
          last_refreshed_at: new Date().toISOString(),
          lineup_confirmed_at: new Date().toISOString(),
          refresh_source: "api-football",
          refresh_notes: "Official lineups pulled from API-Football",
        })
        .eq("id", fixtureId);
    }

    return {
      refreshedAt: new Date().toISOString(),
      source: "api-football",
      status: "lineups",
      homeLineup,
      awayLineup,
      injuries: injuries.length ? injuries : undefined,
      notes: [
        "Official starting XIs confirmed from API-Football.",
        injuries.length
          ? `Injuries refreshed: ${injuries.length} absences.`
          : "No injury feed rows returned for these clubs.",
      ],
    };
  } catch {
    return null;
  }
}

async function refreshProvisionalFromSquads(
  match: MatchDetail,
): Promise<RefreshOverlay> {
  const hours = hoursUntil(match.kickoff);
  let homeLineup = await buildSquadXiFromDb(match.home.id);
  let awayLineup = await buildSquadXiFromDb(match.away.id);
  let source: RefreshSource = "squad";

  if (homeLineup.length < 11 || awayLineup.length < 11) {
    const seedHome = buildSquadXi(match.home.id);
    const seedAway = buildSquadXi(match.away.id);
    if (homeLineup.length < 11) homeLineup = seedHome;
    if (awayLineup.length < 11) awayLineup = seedAway;
    source = "seed";
  }

  const status: FixtureStatus =
    hours <= CONFIRM_WINDOW_HOURS && homeLineup.length >= 11 && awayLineup.length >= 11
      ? "lineups"
      : match.status === "live"
        ? "live"
        : homeLineup.length >= 11
          ? "scheduled"
          : match.status;

  return {
    refreshedAt: new Date().toISOString(),
    source,
    status,
    homeLineup,
    awayLineup,
    injuries: match.injuries,
    notes: [
      hours <= CONFIRM_WINDOW_HOURS
        ? "Inside pre-kickoff window — best available XI from current squads (awaiting official lock)."
        : "No official XI yet — provisional XI from highest-rated squad players + season stats.",
      `Kickoff in ${hours.toFixed(1)}h.`,
    ],
  };
}

function refreshFromSeed(fixtureId: string): RefreshOverlay {
  const fixture = FIXTURES.find((f) => f.id === fixtureId);
  if (!fixture) {
    return {
      refreshedAt: new Date().toISOString(),
      source: "seed",
      notes: ["Fixture not found in seed pack."],
    };
  }

  const existing = LINEUPS[fixtureId];
  const previous = refreshStore.get(fixtureId);
  const notes: string[] = [];
  let homeLineup = previous?.homeLineup ?? existing?.home ?? [];
  let awayLineup = previous?.awayLineup ?? existing?.away ?? [];
  let status: FixtureStatus = fixture.status;
  const hours = hoursUntil(fixture.kickoff);

  if (homeLineup.length < 11 || awayLineup.length < 11) {
    homeLineup = buildSquadXi(fixture.homeTeamId);
    awayLineup = buildSquadXi(fixture.awayTeamId);
    status = hours <= CONFIRM_WINDOW_HOURS ? "lineups" : "scheduled";
    notes.push(
      hours <= CONFIRM_WINDOW_HOURS
        ? "Inside pre-kickoff window — generated XIs from available squads."
        : "No published XI yet — provisional XIs from highest-rated players.",
    );
  } else {
    notes.push("Existing lineups re-validated against active injuries.");
    if (hours <= CONFIRM_WINDOW_HOURS || fixture.status === "lineups") {
      status = fixture.status === "live" ? "live" : "lineups";
    }
  }

  const injuries = INJURIES.filter(
    (injury) =>
      injury.isActive &&
      (injury.teamId === fixture.homeTeamId ||
        injury.teamId === fixture.awayTeamId),
  );

  return {
    refreshedAt: new Date().toISOString(),
    source: "seed",
    status,
    homeLineup,
    awayLineup,
    injuries,
    notes: [
      ...notes,
      `Injuries: ${injuries.length}.`,
      hours >= 0
        ? `Kickoff in ${hours.toFixed(1)}h.`
        : `Kickoff was ${Math.abs(hours).toFixed(1)}h ago.`,
    ],
  };
}

async function persistRefreshLog(result: MatchRefreshResult) {
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase.from("match_refresh_logs").insert({
    fixture_id: result.fixtureId,
    refreshed_at: result.refreshedAt,
    source: result.source,
    lineup_status: result.lineupStatus,
    home_xi_count: result.homeXiCount,
    away_xi_count: result.awayXiCount,
    injury_count: result.injuryCount,
    notes: result.notes,
    meta: { hoursToKickoff: result.hoursToKickoff, changed: result.changed },
  });

  await supabase
    .from("fixtures")
    .update({
      last_refreshed_at: result.refreshedAt,
      refresh_source: result.source,
      refresh_notes: result.notes.join(" · "),
      ...(result.lineupStatus === "confirmed"
        ? { lineup_confirmed_at: result.refreshedAt, status: "lineups" }
        : result.homeXiCount >= 11
          ? { status: "lineups" }
          : {}),
    })
    .eq("id", result.fixtureId);
}

async function loadMatchBase(fixtureId: string): Promise<MatchDetail | null> {
  const seed = getSeedMatchDetail(fixtureId);
  const supabase = createServiceClient();
  if (!supabase) return seed;

  const { data: fixture } = await supabase
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
    .eq("id", fixtureId)
    .maybeSingle();

  if (!fixture) return seed;

  const home = (
    Array.isArray(fixture.home) ? fixture.home[0] : fixture.home
  ) as { id: string; name: string; short_name: string };
  const away = (
    Array.isArray(fixture.away) ? fixture.away[0] : fixture.away
  ) as { id: string; name: string; short_name: string };
  const competition = Array.isArray(fixture.competition)
    ? fixture.competition[0]
    : fixture.competition;

  const [
    { data: lineupRows },
    { data: injuryRows },
    { data: teamStats },
  ] = await Promise.all([
    supabase
      .from("lineups")
      .select(
        `team_id, player_id, is_starter, position, shirt_number, player:players(name)`,
      )
      .eq("fixture_id", fixtureId),
    supabase
      .from("injuries")
      .select(
        `id, player_id, team_id, injury_type, reason, is_active, player:players(name)`,
      )
      .eq("is_active", true)
      .in("team_id", [fixture.home_team_id, fixture.away_team_id]),
    supabase
      .from("team_stats")
      .select("*")
      .in("team_id", [fixture.home_team_id, fixture.away_team_id]),
  ]);

  const mapLineup = (teamId: string): LineupEntry[] =>
    (lineupRows ?? [])
      .filter((row) => row.team_id === teamId && row.is_starter)
      .map((row) => {
        const player = Array.isArray(row.player) ? row.player[0] : row.player;
        return {
          playerId: row.player_id,
          teamId: row.team_id,
          playerName: (player as { name?: string } | null)?.name ?? "Unknown",
          isStarter: true,
          position: (row.position as PlayerPosition | null) ?? null,
          shirtNumber: row.shirt_number,
          rating: null,
          goals: 0,
          assists: 0,
        };
      });

  const homeLineup = mapLineup(fixture.home_team_id);
  const awayLineup = mapLineup(fixture.away_team_id);
  const homeStat = (teamStats ?? []).find(
    (s) => s.team_id === fixture.home_team_id,
  );
  const awayStat = (teamStats ?? []).find(
    (s) => s.team_id === fixture.away_team_id,
  );

  const mapStats = (
    row: (typeof teamStats extends (infer T)[] | null ? T : never) | undefined,
    teamId: string,
  ) => {
    if (!row) return null;
    const form = parseForm(row.form as string | null);
    return {
      teamId,
      season: Number(row.season),
      played: Number(row.played),
      wins: Number(row.wins),
      draws: Number(row.draws),
      losses: Number(row.losses),
      goalsFor: Number(row.goals_for),
      goalsAgainst: Number(row.goals_against),
      form,
      homeForm: form,
      awayForm: form,
    };
  };

  return {
    id: fixture.id,
    competition: (competition as { name?: string } | null)?.name ?? "Premier League",
    kickoff: fixture.kickoff,
    venue: fixture.venue ?? "",
    status: fixture.status as FixtureStatus,
    home: {
      id: home.id,
      name: home.name,
      shortName: home.short_name,
      form: mapStats(homeStat, home.id)?.form ?? [],
    },
    away: {
      id: away.id,
      name: away.name,
      shortName: away.short_name,
      form: mapStats(awayStat, away.id)?.form ?? [],
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
        playerName: (player as { name?: string } | null)?.name ?? "Unknown",
        injuryType: row.injury_type,
        reason: row.reason,
        isActive: Boolean(row.is_active),
      };
    }),
    homeStats: mapStats(homeStat, home.id),
    awayStats: mapStats(awayStat, away.id),
    headToHead: [],
    lineupStatus: resolveLineupStatus(
      fixture.status as FixtureStatus,
      homeLineup.length,
      awayLineup.length,
    ),
    dataSource: "supabase",
  };
}

export async function refreshMatchForKickoff(
  fixtureId: string,
): Promise<{ match: MatchDetail; refresh: MatchRefreshResult }> {
  const current = (await loadMatchBase(fixtureId)) ?? getSeedMatchDetail(fixtureId);
  if (!current) {
    throw new Error("Fixture not found");
  }

  const previous = refreshStore.get(fixtureId);
  const hours = hoursUntil(current.kickoff);
  const cacheTtl = hours <= NEAR_KICKOFF_HOURS ? CACHE_MS_NEAR : CACHE_MS_FAR;
  const cacheFresh =
    previous &&
    Date.now() - new Date(previous.refreshedAt).getTime() < cacheTtl &&
    (previous.homeLineup?.length ?? 0) >= 11 &&
    (previous.awayLineup?.length ?? 0) >= 11;

  const forceApi = hours <= NEAR_KICKOFF_HOURS && !cacheFresh;

  let overlay: RefreshOverlay;
  if (cacheFresh && !forceApi) {
    overlay = {
      ...previous!,
      source: "cache",
      notes: [
        ...(previous!.notes ?? []),
        `Used refresh cache (${Math.round(cacheTtl / 1000)}s TTL).`,
      ],
    };
  } else {
    const externalId = await resolveExternalFixtureId(fixtureId);
    overlay =
      (await refreshFromApiFootball(
        fixtureId,
        externalId,
        current.home.id,
        current.away.id,
      )) ?? (await refreshProvisionalFromSquads(current));

    if (
      overlay.source !== "api-football" &&
      fixtureId.startsWith("fx-") &&
      (!overlay.homeLineup || overlay.homeLineup.length < 11)
    ) {
      overlay = refreshFromSeed(fixtureId);
    }
  }

  refreshStore.set(fixtureId, overlay);
  const matched = applyRefreshOverlay(current);

  const refresh: MatchRefreshResult = {
    fixtureId,
    refreshedAt: overlay.refreshedAt,
    source: overlay.source,
    lineupStatus: matched.lineupStatus,
    homeXiCount: matched.homeLineup.length,
    awayXiCount: matched.awayLineup.length,
    injuryCount: matched.injuries.length,
    hoursToKickoff: Number(hours.toFixed(2)),
    notes: overlay.notes,
    changed:
      !previous ||
      !sameLineup(previous.homeLineup, overlay.homeLineup) ||
      !sameLineup(previous.awayLineup, overlay.awayLineup) ||
      previous.status !== overlay.status,
  };

  await persistRefreshLog(refresh);
  return { match: matched, refresh };
}

import type {
  FixtureStatus,
  Injury,
  LineupEntry,
  LineupStatus,
  MatchDetail,
  PlayerPosition,
} from "@/lib/data/types";
import { resolveLineupStatus } from "@/lib/data/types";
import {
  FIXTURES,
  INJURIES,
  LINEUPS,
  PLAYERS,
  PLAYER_STATS,
  getSeedMatchDetail,
} from "@/lib/data/seed";
import { createServiceClient } from "@/lib/supabase/admin";

export type RefreshSource = "seed" | "api-football" | "cache";

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

function hoursUntil(kickoffIso: string): number {
  return (new Date(kickoffIso).getTime() - Date.now()) / (1000 * 60 * 60);
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

async function refreshFromApiFootball(
  fixtureId: string,
  externalId: string | null,
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
    };

    const rows = payload.response ?? [];
    if (rows.length < 2) return null;

    const mapPos = (pos: string): PlayerPosition => {
      if (pos === "G") return "GK";
      if (pos === "D") return "DF";
      if (pos === "M") return "MF";
      return "FW";
    };

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

    const home = rows[0];
    const away = rows[1];
    const homeLineup = toLineup(`api-team-${home.team.id}`, home.startXI ?? []);
    const awayLineup = toLineup(`api-team-${away.team.id}`, away.startXI ?? []);

    const supabase = createServiceClient();
    if (supabase && homeLineup.length && awayLineup.length) {
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
      notes: [
        "Pulled official starting XIs from API-Football.",
        "Injuries left unchanged in this refresh pass.",
      ],
    };
  } catch {
    return null;
  }
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
    status = hours <= 1.5 ? "lineups" : "scheduled";
    notes.push(
      hours <= 1.5
        ? "Inside pre-kickoff window — generated confirmed-style XIs from available squads."
        : "No published XI yet — generated provisional XIs from highest-rated available players.",
    );
  } else {
    notes.push("Existing lineups re-validated against active injuries.");
    const injuredIds = new Set(
      INJURIES.filter((i) => i.isActive).map((i) => i.playerId),
    );
    const scrub = (teamId: string, xi: LineupEntry[]) => {
      const clean = xi.filter((p) => !injuredIds.has(p.playerId));
      if (clean.length >= 11) return clean.slice(0, 11);
      const fillers = buildSquadXi(teamId).filter(
        (p) => !clean.some((c) => c.playerId === p.playerId),
      );
      return [...clean, ...fillers].slice(0, 11);
    };
    homeLineup = scrub(fixture.homeTeamId, homeLineup);
    awayLineup = scrub(fixture.awayTeamId, awayLineup);
    if (hours <= 1.5 || fixture.status === "lineups" || fixture.status === "live") {
      status = fixture.status === "live" ? "live" : "lineups";
      notes.push("Pre-kickoff window — lineups treated as confirmed.");
    } else {
      status = "lineups";
      notes.push("Lineups available — marked for prediction use.");
    }
  }

  const injuries = INJURIES.filter(
    (injury) =>
      injury.isActive &&
      (injury.teamId === fixture.homeTeamId ||
        injury.teamId === fixture.awayTeamId),
  );
  notes.push(
    `Injuries refreshed: ${injuries.length} active absence${injuries.length === 1 ? "" : "s"}.`,
  );
  notes.push(
    hours >= 0
      ? `Kickoff in ${hours.toFixed(1)}h.`
      : `Kickoff was ${Math.abs(hours).toFixed(1)}h ago.`,
  );

  return {
    refreshedAt: new Date().toISOString(),
    source: "seed",
    status,
    homeLineup,
    awayLineup,
    injuries,
    notes,
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

export async function refreshMatchForKickoff(
  fixtureId: string,
): Promise<{ match: MatchDetail; refresh: MatchRefreshResult }> {
  const current = getSeedMatchDetail(fixtureId);
  if (!current) {
    throw new Error("Fixture not found");
  }

  const previous = refreshStore.get(fixtureId);
  const externalId = FIXTURES.find((f) => f.id === fixtureId)?.externalId ?? null;
  const overlay =
    (await refreshFromApiFootball(fixtureId, externalId)) ??
    refreshFromSeed(fixtureId);

  refreshStore.set(fixtureId, overlay);
  const match = applyRefreshOverlay(current);

  const refresh: MatchRefreshResult = {
    fixtureId,
    refreshedAt: overlay.refreshedAt,
    source: overlay.source,
    lineupStatus: match.lineupStatus,
    homeXiCount: match.homeLineup.length,
    awayXiCount: match.awayLineup.length,
    injuryCount: match.injuries.length,
    hoursToKickoff: Number(hoursUntil(match.kickoff).toFixed(2)),
    notes: overlay.notes,
    changed:
      !previous ||
      !sameLineup(previous.homeLineup, overlay.homeLineup) ||
      !sameLineup(previous.awayLineup, overlay.awayLineup) ||
      previous.status !== overlay.status,
  };

  await persistRefreshLog(refresh);
  return { match, refresh };
}

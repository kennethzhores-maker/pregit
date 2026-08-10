import {
  PLAYERS,
  PLAYER_STATS,
  TEAMS,
} from "@/lib/data/seed";
import type { PlayerPosition } from "@/lib/data/types";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SimPlayer, SimTeam } from "@/lib/simulation/types";

export { autoPickXi } from "@/lib/simulation/auto-xi";

function seedCatalog(): SimTeam[] {
  const statsByPlayer = new Map(PLAYER_STATS.map((s) => [s.playerId, s]));

  return TEAMS.map((team) => {
    const players: SimPlayer[] = PLAYERS.filter((p) => p.teamId === team.id).map(
      (player) => {
        const stats = statsByPlayer.get(player.id);
        return {
          id: player.id,
          teamId: player.teamId,
          name: player.name,
          position: player.position,
          shirtNumber: player.shirtNumber,
          nationality: player.nationality,
          appearances: stats?.appearances ?? 0,
          minutes: stats?.minutes ?? 0,
          goals: stats?.goals ?? 0,
          assists: stats?.assists ?? 0,
          yellowCards: stats?.yellowCards ?? 0,
          redCards: stats?.redCards ?? 0,
          rating: stats?.rating ?? 6.5,
        };
      },
    );

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      venue: team.venue,
      players,
    };
  }).filter((team) => team.players.length >= 11);
}

function mapPosition(raw: string | null): PlayerPosition {
  const value = (raw ?? "MF").toUpperCase();
  if (value === "GK" || value.includes("GOAL")) return "GK";
  if (value === "DF" || value.includes("DEF") || value.includes("BACK"))
    return "DF";
  if (value === "FW" || value.includes("ATT") || value.includes("FORWARD"))
    return "FW";
  return "MF";
}

async function supabaseCatalog(): Promise<SimTeam[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, short_name, venue")
    .order("name");

  if (teamsError || !teams?.length) return [];

  const { data: players } = await supabase
    .from("players")
    .select("id, team_id, name, position, shirt_number, nationality");

  if (!players?.length) return [];

  const playerIds = players.map((p) => p.id);
  const { data: statsRows } = await supabase
    .from("player_stats")
    .select("*")
    .in("player_id", playerIds);

  const statsByPlayer = new Map(
    (statsRows ?? []).map((row) => [row.player_id as string, row]),
  );

  const byTeam = new Map<string, SimPlayer[]>();
  for (const player of players) {
    const stats = statsByPlayer.get(player.id);
    const entry: SimPlayer = {
      id: player.id,
      teamId: player.team_id,
      name: player.name,
      position: mapPosition(player.position),
      shirtNumber: player.shirt_number,
      nationality: player.nationality,
      appearances: Number(stats?.appearances ?? 0),
      minutes: Number(stats?.minutes ?? 0),
      goals: Number(stats?.goals ?? 0),
      assists: Number(stats?.assists ?? 0),
      yellowCards: Number(stats?.yellow_cards ?? 0),
      redCards: Number(stats?.red_cards ?? 0),
      rating: Number(stats?.rating ?? 6.5),
    };
    const list = byTeam.get(player.team_id) ?? [];
    list.push(entry);
    byTeam.set(player.team_id, list);
  }

  return teams
    .map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.short_name,
      venue: team.venue,
      players: (byTeam.get(team.id) ?? []).sort(
        (a, b) => b.rating - a.rating,
      ),
    }))
    .filter((team) => team.players.length >= 11);
}

/** Prefer DB squads with 11+ players; always fall back to curated seed pack. */
export async function getSimulationCatalog(): Promise<{
  teams: SimTeam[];
  source: "supabase" | "seed" | "mixed";
}> {
  const seeded = seedCatalog();
  const fromDb = await supabaseCatalog();

  if (!fromDb.length) {
    return { teams: seeded, source: "seed" };
  }

  const merged = [...fromDb];
  for (const team of seeded) {
    if (!merged.some((t) => t.id === team.id)) merged.push(team);
  }

  const usable = merged.filter((t) => t.players.length >= 11);
  if (!usable.length) return { teams: seeded, source: "seed" };

  const seedIds = new Set(seeded.map((t) => t.id));
  const hasSeed = usable.some((t) => seedIds.has(t.id));
  const hasDbOnly = usable.some((t) => !seedIds.has(t.id));

  return {
    teams: usable.sort((a, b) => a.name.localeCompare(b.name)),
    source: hasSeed && hasDbOnly ? "mixed" : hasDbOnly ? "supabase" : "seed",
  };
}

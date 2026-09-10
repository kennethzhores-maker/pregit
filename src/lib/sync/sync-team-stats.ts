import { createServiceClient } from "@/lib/supabase/admin";
import {
  footballSeasonCandidates,
  getConfiguredFootballSeason,
  isSeasonPlanError,
} from "@/lib/football/season";

type StandingRow = {
  rank: number;
  team: { id: number; name: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

function formChars(form: string | null): string {
  if (!form) return "";
  return form
    .split("")
    .filter((c) => c === "W" || c === "D" || c === "L")
    .join("");
}

async function fetchStandings(
  apiKey: string,
  leagueId: string,
  season: number,
): Promise<{ table: StandingRow[]; errorText: string | null }> {
  await new Promise((r) => setTimeout(r, 6500));
  const response = await fetch(
    `https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`,
    {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Standings HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    response?: Array<{
      league: { standings: StandingRow[][] };
    }>;
    errors?: unknown;
  };

  if (isSeasonPlanError(payload.errors)) {
    return {
      table: [],
      errorText:
        typeof payload.errors === "object"
          ? JSON.stringify(payload.errors)
          : String(payload.errors),
    };
  }

  const table =
    payload.response?.[0]?.league?.standings?.[0] ??
    payload.response?.[0]?.league?.standings?.flat() ??
    [];

  return { table, errorText: null };
}

/** Sync PL team season stats from standings (1 API call per season try). */
export async function syncPremierLeagueTeamStats(): Promise<{
  status: "success" | "failed" | "skipped";
  teams: number;
  message: string;
  season?: number;
}> {
  const supabase = createServiceClient();
  const apiKey = process.env.FOOTBALL_API_KEY;
  const leagueId = process.env.FOOTBALL_LEAGUE_ID ?? "39";
  const preferred = getConfiguredFootballSeason();

  if (!supabase) {
    return { status: "skipped", teams: 0, message: "Supabase not configured." };
  }
  if (!apiKey) {
    return { status: "skipped", teams: 0, message: "FOOTBALL_API_KEY missing." };
  }

  try {
    let table: StandingRow[] = [];
    let usedSeason = preferred;
    const notes: string[] = [];

    for (const season of footballSeasonCandidates()) {
      const result = await fetchStandings(apiKey, leagueId, season);
      if (result.table.length) {
        table = result.table;
        usedSeason = season;
        if (season !== preferred) {
          notes.push(
            `Requested season ${preferred} unavailable on this API plan; used ${season} standings as strength baseline.`,
          );
        }
        break;
      }
      if (result.errorText) {
        notes.push(`Season ${season}: ${result.errorText}`);
      }
    }

    if (!table.length) {
      return {
        status: "failed",
        teams: 0,
        message:
          notes.join(" ") ||
          `No standings returned for seasons ${footballSeasonCandidates().join(", ")}.`,
      };
    }

    let count = 0;
    for (const row of table) {
      const teamId = `api-team-${row.team.id}`;
      await supabase.from("teams").upsert({
        id: teamId,
        external_id: String(row.team.id),
        competition_id: "pl",
        name: row.team.name,
        short_name: row.team.name.slice(0, 3).toUpperCase(),
      });

      await supabase.from("team_stats").upsert(
        {
          team_id: teamId,
          season: usedSeason,
          played: row.all.played,
          wins: row.all.win,
          draws: row.all.draw,
          losses: row.all.lose,
          goals_for: row.all.goals.for,
          goals_against: row.all.goals.against,
          form: formChars(row.form),
          home_form: formChars(
            `${"W".repeat(row.home.win)}${"D".repeat(row.home.draw)}${"L".repeat(row.home.lose)}`.slice(
              0,
              5,
            ),
          ),
          away_form: formChars(
            `${"W".repeat(row.away.win)}${"D".repeat(row.away.draw)}${"L".repeat(row.away.lose)}`.slice(
              0,
              5,
            ),
          ),
        },
        { onConflict: "team_id,season" },
      );
      count += 1;
    }

    return {
      status: "success",
      teams: count,
      season: usedSeason,
      message: `Synced team stats/standings for ${count} clubs (season ${usedSeason}).${
        notes.length ? ` ${notes.join(" ")}` : ""
      }`,
    };
  } catch (error) {
    return {
      status: "failed",
      teams: 0,
      message: error instanceof Error ? error.message : "Standings sync failed",
    };
  }
}

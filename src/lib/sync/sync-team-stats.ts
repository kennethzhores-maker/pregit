import { createServiceClient } from "@/lib/supabase/admin";

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

/** Sync PL team season stats from standings (1 API call). */
export async function syncPremierLeagueTeamStats(): Promise<{
  status: "success" | "failed" | "skipped";
  teams: number;
  message: string;
}> {
  const supabase = createServiceClient();
  const apiKey = process.env.FOOTBALL_API_KEY;
  const leagueId = process.env.FOOTBALL_LEAGUE_ID ?? "39";
  const season = process.env.FOOTBALL_SEASON ?? "2024";

  if (!supabase) {
    return { status: "skipped", teams: 0, message: "Supabase not configured." };
  }
  if (!apiKey) {
    return { status: "skipped", teams: 0, message: "FOOTBALL_API_KEY missing." };
  }

  try {
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

    const table =
      payload.response?.[0]?.league?.standings?.[0] ??
      payload.response?.[0]?.league?.standings?.flat() ??
      [];

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
          season: Number(season),
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
      message: `Synced team stats/standings for ${count} clubs (season ${season}).`,
    };
  } catch (error) {
    return {
      status: "failed",
      teams: 0,
      message: error instanceof Error ? error.message : "Standings sync failed",
    };
  }
}

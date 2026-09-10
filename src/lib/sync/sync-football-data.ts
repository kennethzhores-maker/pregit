import { createServiceClient } from "@/lib/supabase/admin";
import { teamRowIdFromFd } from "@/lib/football/fd-team-map";
import {
  footballDataGet,
  getFootballDataToken,
  mapFdMatchStatus,
  resolveFdSeason,
  type FdMatch,
  type FdStandingRow,
} from "@/lib/football/football-data-client";

export type FootballDataSyncResult = {
  status: "success" | "failed" | "skipped";
  recordsUpserted: number;
  message: string;
  season?: number;
};

function formChars(form: string | null): string {
  if (!form) return "";
  return form
    .split("")
    .filter((c) => c === "W" || c === "D" || c === "L")
    .join("")
    .slice(-5);
}

/** Sync current PL standings → team_stats (1 request). */
export async function syncStandingsFromFootballData(): Promise<FootballDataSyncResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { status: "skipped", recordsUpserted: 0, message: "Supabase not configured." };
  }
  if (!getFootballDataToken()) {
    return {
      status: "skipped",
      recordsUpserted: 0,
      message: "FOOTBALL_DATA_TOKEN missing.",
    };
  }

  const season = Number(resolveFdSeason());

  try {
    const payload = await footballDataGet<{
      standings?: Array<{ type: string; table: FdStandingRow[] }>;
    }>("/competitions/PL/standings", { season: String(season) });

    const table =
      payload.standings?.find((s) => s.type === "TOTAL")?.table ??
      payload.standings?.[0]?.table ??
      [];

    if (!table.length) {
      return {
        status: "failed",
        recordsUpserted: 0,
        message: `football-data.org returned no PL standings for season ${season}.`,
        season,
      };
    }

    await supabase.from("competitions").upsert({
      id: "pl",
      external_id: "PL",
      name: "Premier League",
      country: "England",
      season,
    });

    let count = 0;
    for (const row of table) {
      const teamId = teamRowIdFromFd(row.team.id, row.team.name);
      await supabase.from("teams").upsert({
        id: teamId,
        external_id: String(
          teamId.startsWith("api-team-")
            ? teamId.slice("api-team-".length)
            : row.team.id,
        ),
        competition_id: "pl",
        name: row.team.name,
        short_name: (
          row.team.tla ??
          row.team.shortName ??
          row.team.name.slice(0, 3)
        ).toUpperCase(),
        crest_url: row.team.crest ?? null,
      });

      await supabase.from("team_stats").upsert(
        {
          team_id: teamId,
          season,
          played: row.playedGames,
          wins: row.won,
          draws: row.draw,
          losses: row.lost,
          goals_for: row.goalsFor,
          goals_against: row.goalsAgainst,
          form: formChars(row.form),
          home_form: formChars(row.form),
          away_form: formChars(row.form),
        },
        { onConflict: "team_id,season" },
      );
      count += 1;
    }

    return {
      status: "success",
      recordsUpserted: count,
      season,
      message: `Synced ${count} PL clubs from football-data.org standings (season ${season}).`,
    };
  } catch (error) {
    return {
      status: "failed",
      recordsUpserted: 0,
      season,
      message:
        error instanceof Error
          ? error.message
          : "football-data.org standings sync failed",
    };
  }
}

type FixtureSyncMode = "hourly" | "nightly";

/** Sync PL fixtures/results from football-data.org. */
export async function syncFixturesFromFootballData(
  mode: FixtureSyncMode,
): Promise<FootballDataSyncResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { status: "skipped", recordsUpserted: 0, message: "Supabase not configured." };
  }
  if (!getFootballDataToken()) {
    return {
      status: "skipped",
      recordsUpserted: 0,
      message: "FOOTBALL_DATA_TOKEN missing.",
    };
  }

  const season = Number(resolveFdSeason());
  const params: Record<string, string> = { season: String(season) };

  if (mode === "hourly") {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 14);
    params.dateFrom = from.toISOString().slice(0, 10);
    params.dateTo = to.toISOString().slice(0, 10);
  }

  try {
    const payload = await footballDataGet<{ matches?: FdMatch[] }>(
      "/competitions/PL/matches",
      params,
    );
    const matches = payload.matches ?? [];

    await supabase.from("competitions").upsert({
      id: "pl",
      external_id: "PL",
      name: "Premier League",
      country: "England",
      season,
    });

    let records = 0;
    for (const match of matches) {
      const homeId = teamRowIdFromFd(match.homeTeam.id, match.homeTeam.name);
      const awayId = teamRowIdFromFd(match.awayTeam.id, match.awayTeam.name);

      await supabase.from("teams").upsert([
        {
          id: homeId,
          external_id: String(
            homeId.startsWith("api-team-")
              ? homeId.slice("api-team-".length)
              : match.homeTeam.id,
          ),
          competition_id: "pl",
          name: match.homeTeam.name,
          short_name: (
            match.homeTeam.tla ??
            match.homeTeam.shortName ??
            match.homeTeam.name.slice(0, 3)
          ).toUpperCase(),
          crest_url: match.homeTeam.crest ?? null,
        },
        {
          id: awayId,
          external_id: String(
            awayId.startsWith("api-team-")
              ? awayId.slice("api-team-".length)
              : match.awayTeam.id,
          ),
          competition_id: "pl",
          name: match.awayTeam.name,
          short_name: (
            match.awayTeam.tla ??
            match.awayTeam.shortName ??
            match.awayTeam.name.slice(0, 3)
          ).toUpperCase(),
          crest_url: match.awayTeam.crest ?? null,
        },
      ]);
      records += 2;

      await supabase.from("fixtures").upsert({
        id: `fd-fx-${match.id}`,
        external_id: String(match.id),
        competition_id: "pl",
        home_team_id: homeId,
        away_team_id: awayId,
        kickoff: match.utcDate,
        venue: match.venue ?? null,
        status: mapFdMatchStatus(match.status),
        home_score: match.score.fullTime.home,
        away_score: match.score.fullTime.away,
        referee: match.referees?.[0]?.name ?? null,
        round: match.matchday != null ? `Matchday ${match.matchday}` : null,
      });
      records += 1;
    }

    return {
      status: "success",
      recordsUpserted: records,
      season,
      message: `Synced ${matches.length} PL fixtures from football-data.org (season ${season}, ${mode}).`,
    };
  } catch (error) {
    return {
      status: "failed",
      recordsUpserted: 0,
      season,
      message:
        error instanceof Error
          ? error.message
          : "football-data.org fixture sync failed",
    };
  }
}

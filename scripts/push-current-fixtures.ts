/**
 * Push published 2026/27 PL Matchweeks 3–5 into Supabase.
 * Used when API-Football free plan cannot read season 2026 and
 * FOOTBALL_DATA_TOKEN is not set yet.
 */
import { createClient } from "@supabase/supabase-js";

type TeamDef = { id: string; externalId: string; name: string; short: string; venue?: string };

const TEAMS: TeamDef[] = [
  { id: "api-team-40", externalId: "40", name: "Liverpool", short: "LIV", venue: "Anfield" },
  { id: "api-team-42", externalId: "42", name: "Arsenal", short: "ARS", venue: "Emirates Stadium" },
  { id: "api-team-50", externalId: "50", name: "Manchester City", short: "MCI", venue: "Etihad Stadium" },
  { id: "api-team-49", externalId: "49", name: "Chelsea", short: "CHE", venue: "Stamford Bridge" },
  { id: "api-team-34", externalId: "34", name: "Newcastle United", short: "NEW", venue: "St. James' Park" },
  { id: "api-team-66", externalId: "66", name: "Aston Villa", short: "AVL", venue: "Villa Park" },
  { id: "api-team-65", externalId: "65", name: "Nottingham Forest", short: "NFO", venue: "City Ground" },
  { id: "api-team-51", externalId: "51", name: "Brighton & Hove Albion", short: "BHA", venue: "American Express Stadium" },
  { id: "api-team-35", externalId: "35", name: "AFC Bournemouth", short: "BOU", venue: "Vitality Stadium" },
  { id: "api-team-55", externalId: "55", name: "Brentford", short: "BRE", venue: "Gtech Community Stadium" },
  { id: "api-team-36", externalId: "36", name: "Fulham", short: "FUL", venue: "Craven Cottage" },
  { id: "api-team-52", externalId: "52", name: "Crystal Palace", short: "CRY", venue: "Selhurst Park" },
  { id: "api-team-45", externalId: "45", name: "Everton", short: "EVE", venue: "Hill Dickinson Stadium" },
  { id: "api-team-33", externalId: "33", name: "Manchester United", short: "MUN", venue: "Old Trafford" },
  { id: "api-team-47", externalId: "47", name: "Tottenham Hotspur", short: "TOT", venue: "Tottenham Hotspur Stadium" },
  { id: "api-team-57", externalId: "57", name: "Ipswich Town", short: "IPS", venue: "Portman Road" },
  { id: "api-team-63", externalId: "63", name: "Leeds United", short: "LEE", venue: "Elland Road" },
  { id: "api-team-71", externalId: "71", name: "Sunderland", short: "SUN", venue: "Stadium of Light" },
  { id: "api-team-64", externalId: "64", name: "Hull City", short: "HUL", venue: "MKM Stadium" },
  { id: "api-team-748", externalId: "748", name: "Coventry City", short: "COV", venue: "Coventry Building Society Arena" },
];

type FixDef = {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  round: string;
  status: "scheduled" | "finished";
  homeScore?: number | null;
  awayScore?: number | null;
};

/** Kickoffs in Europe/London local as ISO offsets. */
const FIXTURES: FixDef[] = [
  // Matchweek 3 (played — scores unknown; marked finished without score for listing)
  { id: "pl2627-mw3-01", home: "api-team-57", away: "api-team-40", kickoff: "2026-09-04T20:00:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-02", home: "api-team-34", away: "api-team-35", kickoff: "2026-09-05T12:30:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-03", home: "api-team-55", away: "api-team-71", kickoff: "2026-09-05T15:00:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-04", home: "api-team-51", away: "api-team-63", kickoff: "2026-09-05T15:00:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-05", home: "api-team-36", away: "api-team-52", kickoff: "2026-09-05T15:00:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-06", home: "api-team-50", away: "api-team-748", kickoff: "2026-09-05T15:00:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-07", home: "api-team-65", away: "api-team-47", kickoff: "2026-09-05T15:00:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-08", home: "api-team-64", away: "api-team-66", kickoff: "2026-09-05T17:30:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-09", home: "api-team-45", away: "api-team-33", kickoff: "2026-09-06T14:00:00+01:00", round: "Matchday 3", status: "finished" },
  { id: "pl2627-mw3-10", home: "api-team-42", away: "api-team-49", kickoff: "2026-09-06T16:30:00+01:00", round: "Matchday 3", status: "finished" },

  // Matchweek 4 (upcoming from 10 Sep 2026)
  { id: "pl2627-mw4-01", home: "api-team-35", away: "api-team-55", kickoff: "2026-09-12T15:00:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-02", home: "api-team-66", away: "api-team-65", kickoff: "2026-09-12T15:00:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-03", home: "api-team-49", away: "api-team-64", kickoff: "2026-09-12T15:00:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-04", home: "api-team-52", away: "api-team-57", kickoff: "2026-09-12T15:00:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-05", home: "api-team-40", away: "api-team-36", kickoff: "2026-09-12T15:00:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-06", home: "api-team-47", away: "api-team-45", kickoff: "2026-09-12T17:30:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-07", home: "api-team-71", away: "api-team-42", kickoff: "2026-09-12T20:00:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-08", home: "api-team-748", away: "api-team-51", kickoff: "2026-09-13T14:00:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-09", home: "api-team-33", away: "api-team-50", kickoff: "2026-09-13T16:30:00+01:00", round: "Matchday 4", status: "scheduled" },
  { id: "pl2627-mw4-10", home: "api-team-63", away: "api-team-34", kickoff: "2026-09-14T20:00:00+01:00", round: "Matchday 4", status: "scheduled" },

  // Matchweek 5
  { id: "pl2627-mw5-01", home: "api-team-55", away: "api-team-49", kickoff: "2026-09-18T20:00:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-02", home: "api-team-47", away: "api-team-66", kickoff: "2026-09-19T12:30:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-03", home: "api-team-51", away: "api-team-42", kickoff: "2026-09-19T15:00:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-04", home: "api-team-45", away: "api-team-57", kickoff: "2026-09-19T15:00:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-05", home: "api-team-63", away: "api-team-52", kickoff: "2026-09-19T15:00:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-06", home: "api-team-50", away: "api-team-71", kickoff: "2026-09-19T15:00:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-07", home: "api-team-34", away: "api-team-64", kickoff: "2026-09-19T15:00:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-08", home: "api-team-65", away: "api-team-748", kickoff: "2026-09-19T17:30:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-09", home: "api-team-35", away: "api-team-40", kickoff: "2026-09-20T14:00:00+01:00", round: "Matchday 5", status: "scheduled" },
  { id: "pl2627-mw5-10", home: "api-team-36", away: "api-team-33", kickoff: "2026-09-20T16:30:00+01:00", round: "Matchday 5", status: "scheduled" },
];

const venueByTeam = new Map(TEAMS.map((t) => [t.id, t.venue ?? ""]));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await sb.from("competitions").upsert({
    id: "pl",
    external_id: "39",
    name: "Premier League",
    country: "England",
    season: 2026,
  });

  await sb.from("teams").upsert(
    TEAMS.map((t) => ({
      id: t.id,
      external_id: t.externalId,
      competition_id: "pl",
      name: t.name,
      short_name: t.short,
      venue: t.venue ?? null,
    })),
  );

  // Hide stale free-API / old demo fixtures from the board
  const { error: delErr, count } = await sb
    .from("fixtures")
    .delete({ count: "exact" })
    .or(
      "id.like.api-fx-%,id.like.fx-%,kickoff.lt.2026-09-01T00:00:00Z",
    );

  if (delErr) {
    console.warn("Could not prune old fixtures:", delErr.message);
  } else {
    console.log(`Pruned ${count ?? 0} pre-2026/27 api-fx fixtures.`);
  }

  const rows = FIXTURES.map((f) => ({
    id: f.id,
    external_id: f.id,
    competition_id: "pl",
    home_team_id: f.home,
    away_team_id: f.away,
    kickoff: f.kickoff,
    venue: venueByTeam.get(f.home) || null,
    status: f.status,
    home_score: f.homeScore ?? null,
    away_score: f.awayScore ?? null,
    referee: null,
    round: f.round,
  }));

  const { error } = await sb.from("fixtures").upsert(rows);
  if (error) throw error;

  console.log(
    JSON.stringify(
      {
        status: "success",
        teams: TEAMS.length,
        fixtures: rows.length,
        upcoming: rows.filter((r) => r.status === "scheduled").length,
        message: "Loaded 2026/27 Matchweeks 3–5 (MW4–5 upcoming).",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

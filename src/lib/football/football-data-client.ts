import { getConfiguredFootballSeason } from "@/lib/football/season";

const BASE = "https://api.football-data.org/v4";

export type FdTeam = {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

export type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  venue?: string | null;
  referees?: Array<{ name: string }>;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
};

export type FdStandingRow = {
  position: number;
  team: FdTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  form: string | null;
};

export function getFootballDataToken(): string | null {
  const token = process.env.FOOTBALL_DATA_TOKEN?.trim();
  return token || null;
}

export async function footballDataGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const token = getFootballDataToken();
  if (!token) {
    throw new Error("FOOTBALL_DATA_TOKEN is not set.");
  }

  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": token,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `football-data.org HTTP ${response.status}: ${body.slice(0, 240)}`,
    );
  }

  return (await response.json()) as T;
}

export function resolveFdSeason(): string {
  return String(getConfiguredFootballSeason());
}

export function mapFdMatchStatus(status: string): string {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
      return "scheduled";
    case "IN_PLAY":
    case "PAUSED":
    case "LIVE":
      return "live";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "POSTPONED":
      return "postponed";
    case "CANCELLED":
    case "SUSPENDED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

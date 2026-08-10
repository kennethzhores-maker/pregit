export type FormResult = "W" | "D" | "L";
export type PlayerPosition = "GK" | "DF" | "MF" | "FW";
export type FixtureStatus =
  | "scheduled"
  | "lineups"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";
export type LineupStatus = "confirmed" | "provisional" | "unavailable";

export type Competition = {
  id: string;
  externalId: string | null;
  name: string;
  country: string | null;
  season: number;
};

export type Team = {
  id: string;
  externalId: string | null;
  competitionId: string;
  name: string;
  shortName: string;
  tla: string | null;
  crestUrl: string | null;
  venue: string | null;
};

export type Player = {
  id: string;
  externalId: string | null;
  teamId: string;
  name: string;
  position: PlayerPosition;
  shirtNumber: number | null;
  nationality: string | null;
};

export type TeamStats = {
  teamId: string;
  season: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  form: FormResult[];
  homeForm: FormResult[];
  awayForm: FormResult[];
};

export type PlayerStats = {
  playerId: string;
  season: number;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
};

export type Injury = {
  id: string;
  playerId: string;
  teamId: string;
  playerName: string;
  injuryType: string | null;
  reason: string | null;
  isActive: boolean;
};

export type LineupEntry = {
  playerId: string;
  teamId: string;
  playerName: string;
  isStarter: boolean;
  position: PlayerPosition | null;
  shirtNumber: number | null;
  rating: number | null;
  goals: number;
  assists: number;
};

export type HeadToHeadResult = {
  id: string;
  kickoff: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
};

export type FixtureListItem = {
  id: string;
  competition: string;
  kickoff: string;
  venue: string;
  status: FixtureStatus;
  home: {
    id: string;
    name: string;
    shortName: string;
    form: FormResult[];
  };
  away: {
    id: string;
    name: string;
    shortName: string;
    form: FormResult[];
  };
  homeScore: number | null;
  awayScore: number | null;
  lineupStatus?: LineupStatus;
};

export type MatchDetail = FixtureListItem & {
  referee: string | null;
  round: string | null;
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  injuries: Injury[];
  homeStats: TeamStats | null;
  awayStats: TeamStats | null;
  headToHead: HeadToHeadResult[];
  lineupStatus: LineupStatus;
  dataSource: "supabase" | "seed";
};

export function parseForm(form: string | null | undefined): FormResult[] {
  if (!form) return [];
  return form
    .split("")
    .filter((c): c is FormResult => c === "W" || c === "D" || c === "L");
}

export function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function resolveLineupStatus(
  status: FixtureStatus,
  homeCount: number,
  awayCount: number,
): LineupStatus {
  if (homeCount >= 11 && awayCount >= 11) {
    return status === "scheduled" ? "provisional" : "confirmed";
  }
  if (homeCount > 0 || awayCount > 0) return "provisional";
  return "unavailable";
}

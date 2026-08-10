import type { PlayerPosition } from "@/lib/data/types";

export type SimPlayer = {
  id: string;
  teamId: string;
  name: string;
  position: PlayerPosition;
  shirtNumber: number | null;
  nationality: string | null;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number;
};

export type SimTeam = {
  id: string;
  name: string;
  shortName: string;
  venue: string | null;
  players: SimPlayer[];
};

export type SimEventType =
  | "kickoff"
  | "chance"
  | "shot"
  | "goal"
  | "save"
  | "foul"
  | "card"
  | "ht"
  | "ft"
  | "note";

export type SimEvent = {
  minute: number;
  type: SimEventType;
  side: "home" | "away" | "none";
  playerName?: string;
  text: string;
};

export type MatchStats = {
  possessionHome: number;
  possessionAway: number;
  shotsHome: number;
  shotsAway: number;
  shotsOnTargetHome: number;
  shotsOnTargetAway: number;
  cornersHome: number;
  cornersAway: number;
  foulsHome: number;
  foulsAway: number;
  yellowsHome: number;
  yellowsAway: number;
};

export type LiveMatchState = {
  minute: number;
  phase: "idle" | "playing" | "ht" | "finished";
  homeScore: number;
  awayScore: number;
  events: SimEvent[];
  stats: MatchStats;
  scorers: { home: string[]; away: string[] };
};

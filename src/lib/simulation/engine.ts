import type {
  LiveMatchState,
  MatchStats,
  SimEvent,
  SimPlayer,
} from "@/lib/simulation/types";

export type SideStrength = {
  attack: number;
  midfield: number;
  defence: number;
  gk: number;
  names: SimPlayer[];
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function avg(values: number[], fallback = 6.6) {
  if (!values.length) return fallback;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildSideStrength(xi: SimPlayer[]): SideStrength {
  const atk = xi.filter((p) => p.position === "FW" || p.position === "MF");
  const mid = xi.filter((p) => p.position === "MF");
  const def = xi.filter((p) => p.position === "DF");
  const gk = xi.filter((p) => p.position === "GK");

  const attack =
    avg(atk.map((p) => p.rating)) * 0.7 +
    avg(atk.map((p) => p.goals / Math.max(1, p.appearances))) * 8 +
    avg(atk.map((p) => p.assists / Math.max(1, p.appearances))) * 4;

  const midfield =
    avg(mid.map((p) => p.rating)) * 0.85 +
    avg(mid.map((p) => p.assists / Math.max(1, p.appearances))) * 3;

  const defence =
    avg(def.map((p) => p.rating)) * 0.9 -
    avg(def.map((p) => p.yellowCards / Math.max(1, p.appearances))) * 0.4;

  const gkRating = avg(gk.map((p) => p.rating), 6.7);

  return {
    attack: Math.max(5.5, attack),
    midfield: Math.max(5.5, midfield),
    defence: Math.max(5.5, defence),
    gk: Math.max(5.5, gkRating),
    names: xi,
  };
}

function emptyStats(): MatchStats {
  return {
    possessionHome: 50,
    possessionAway: 50,
    shotsHome: 0,
    shotsAway: 0,
    shotsOnTargetHome: 0,
    shotsOnTargetAway: 0,
    cornersHome: 0,
    cornersAway: 0,
    foulsHome: 0,
    foulsAway: 0,
    yellowsHome: 0,
    yellowsAway: 0,
  };
}

export function createKickoffState(
  homeName: string,
  awayName: string,
  venue: string | null,
): LiveMatchState {
  return {
    minute: 0,
    phase: "playing",
    homeScore: 0,
    awayScore: 0,
    events: [
      {
        minute: 1,
        type: "kickoff",
        side: "none",
        text: `Kickoff${venue ? ` at ${venue}` : ""} — ${homeName} vs ${awayName}.`,
      },
    ],
    stats: emptyStats(),
    scorers: { home: [], away: [] },
  };
}

function pickAttacker(xi: SimPlayer[], rand: () => number): SimPlayer {
  const pool = xi.filter((p) => p.position === "FW" || p.position === "MF");
  const list = pool.length ? pool : xi;
  return list[Math.floor(rand() * list.length)] ?? xi[0];
}

/**
 * Advance one match minute. Returns updated state (immutable-ish copy).
 */
export function stepMinute(
  state: LiveMatchState,
  home: SideStrength,
  away: SideStrength,
  seedKey: string,
): LiveMatchState {
  if (state.phase === "finished") return state;

  const nextMinute = Math.min(90, state.minute + 1);
  const rand = mulberry32(hashSeed(`${seedKey}:${nextMinute}`));
  const events = [...state.events];
  const stats = { ...state.stats };
  let homeScore = state.homeScore;
  let awayScore = state.awayScore;
  const scorers = {
    home: [...state.scorers.home],
    away: [...state.scorers.away],
  };
  let phase: LiveMatchState["phase"] = state.phase;

  if (nextMinute === 46 && state.minute < 46) {
    events.push({
      minute: 45,
      type: "ht",
      side: "none",
      text: `Half-time ${homeScore}-${awayScore}.`,
    });
    phase = "ht";
  }
  if (nextMinute === 47) phase = "playing";

  const homePress =
    (home.attack + home.midfield) /
    (home.attack + home.midfield + away.attack + away.midfield || 1);
  stats.possessionHome = Math.round(
    Math.min(68, Math.max(32, homePress * 100 + (rand() - 0.5) * 6)),
  );
  stats.possessionAway = 100 - stats.possessionHome;

  const fatigue = 1 - (nextMinute / 90) * 0.12;
  const homeChance =
    ((home.attack * fatigue) / (away.defence * 0.85 + away.gk * 0.35)) * 0.055;
  const awayChance =
    ((away.attack * fatigue) / (home.defence * 0.85 + home.gk * 0.35)) * 0.05;

  const tryAttack = (side: "home" | "away", chance: number) => {
    if (rand() > chance) return;
    const unit = side === "home" ? home : away;
    const player = pickAttacker(unit.names, rand);
    const onTarget = rand() < 0.42 + (unit.attack - 6.5) * 0.05;

    if (side === "home") {
      stats.shotsHome += 1;
      if (onTarget) stats.shotsOnTargetHome += 1;
    } else {
      stats.shotsAway += 1;
      if (onTarget) stats.shotsOnTargetAway += 1;
    }

    if (!onTarget) {
      events.push({
        minute: nextMinute,
        type: "shot",
        side,
        playerName: player.name,
        text: `${player.name} shoots — off target.`,
      });
      if (rand() < 0.35) {
        if (side === "home") stats.cornersHome += 1;
        else stats.cornersAway += 1;
      }
      return;
    }

    const finishP =
      0.28 +
      (unit.attack - (side === "home" ? away.gk : home.gk)) * 0.08 +
      rand() * 0.08;

    if (rand() < finishP) {
      if (side === "home") {
        homeScore += 1;
        scorers.home.push(`${player.name} ${nextMinute}'`);
      } else {
        awayScore += 1;
        scorers.away.push(`${player.name} ${nextMinute}'`);
      }
      events.push({
        minute: nextMinute,
        type: "goal",
        side,
        playerName: player.name,
        text: `GOAL! ${player.name} — ${homeScore}-${awayScore}.`,
      });
    } else {
      events.push({
        minute: nextMinute,
        type: "save",
        side,
        playerName: player.name,
        text: `Saved — ${player.name} denied.`,
      });
    }
  };

  tryAttack("home", homeChance);
  tryAttack("away", awayChance);

  if (rand() < 0.08) {
    const side: "home" | "away" = rand() < homePress ? "away" : "home";
    if (side === "home") {
      stats.foulsHome += 1;
      if (rand() < 0.25) stats.yellowsHome += 1;
    } else {
      stats.foulsAway += 1;
      if (rand() < 0.25) stats.yellowsAway += 1;
    }
    const fouler = pickAttacker(
      side === "home" ? home.names : away.names,
      rand,
    );
    events.push({
      minute: nextMinute,
      type: rand() < 0.25 ? "card" : "foul",
      side,
      playerName: fouler.name,
      text:
        rand() < 0.25
          ? `Yellow card — ${fouler.name}.`
          : `Foul by ${fouler.name}.`,
    });
  }

  if (nextMinute >= 90) {
    events.push({
      minute: 90,
      type: "ft",
      side: "none",
      text: `Full-time ${homeScore}-${awayScore}.`,
    });
    phase = "finished";
  }

  return {
    minute: nextMinute,
    phase,
    homeScore,
    awayScore,
    events: events.slice(-80),
    stats,
    scorers,
  };
}

export type { SimEvent };

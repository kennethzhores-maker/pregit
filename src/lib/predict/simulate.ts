import type { MatchDetail } from "@/lib/data/types";
import type { PredictFeatures, ScorelineProbability } from "@/lib/predict/types";
import { DEFAULT_SIM_ITERATIONS } from "@/lib/predict/types";

export type SideUnits = {
  attack: number;
  midfield: number;
  defence: number;
  gk: number;
  stamina: number;
};

export type SimulationResult = {
  iterations: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  mostLikelyScore: string;
  topScorelines: ScorelineProbability[];
  homeUnits: SideUnits;
  awayUnits: SideUnits;
  bttsPct: number;
  over25Pct: number;
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

function normalizeRating(rating: number) {
  return Math.min(1.28, Math.max(0.68, 0.68 + (rating - 6.4) * 0.22));
}

export function rateSideUnits(
  match: MatchDetail,
  side: "home" | "away",
  features: PredictFeatures,
): SideUnits {
  const attack =
    side === "home" ? features.home_attack_xi : features.away_attack_xi;
  const midfield =
    side === "home" ? features.home_xi_rating : features.away_xi_rating;
  const defence =
    side === "home" ? features.home_defence_xi : features.away_defence_xi;
  const gk =
    side === "home" ? features.home_defence_xi : features.away_defence_xi;

  const formPts =
    side === "home" ? features.home_form_pts : features.away_form_pts;
  const rest =
    side === "home" ? features.rest_days_home : features.rest_days_away;
  const congestion =
    side === "home" ? features.congestion_home : features.congestion_away;
  const injAtk =
    side === "home"
      ? features.home_injury_attack_pen
      : features.away_injury_attack_pen;
  const injDef =
    side === "home"
      ? features.home_injury_defence_pen
      : features.away_injury_defence_pen;
  const styleAtk =
    side === "home" ? features.home_style_attack : features.away_style_attack;
  const styleBlock =
    side === "home" ? features.home_style_block : features.away_style_block;
  const setPiece =
    side === "home" ? features.set_piece_home : features.set_piece_away;

  const formMul = 1 + (formPts - 7.5) * 0.022;
  const stamina = Math.min(
    1.1,
    Math.max(0.82, 0.9 + (rest - 4) * 0.03 - congestion * 0.08 - injAtk * 0.15),
  );

  return {
    attack: normalizeRating(attack) * formMul * styleAtk * setPiece * (1 - injAtk),
    midfield: normalizeRating(midfield) * formMul * (1 - injAtk * 0.5),
    defence: normalizeRating(defence) * styleBlock * (1 - injDef),
    gk: normalizeRating(gk) * (1 - injDef * 0.8),
    stamina,
  };
}

function simulateOne(
  home: SideUnits,
  away: SideUnits,
  homeAdv: number,
  rng: () => number,
): { homeGoals: number; awayGoals: number } {
  let homeGoals = 0;
  let awayGoals = 0;

  // 6 × 15-minute blocks ≈ same expected goals as a 90' loop, ~15× less work
  const BLOCK = 15;
  for (let block = 0; block < 6; block += 1) {
    const minute = block * BLOCK + 8;
    const late = minute >= 75 ? 0.92 : minute >= 60 ? 0.97 : 1;
    const homeFatigue = home.stamina * late;
    const awayFatigue = away.stamina * late;

    const homeChance =
      0.042 *
      BLOCK *
      ((home.attack * 0.62 + home.midfield * 0.38) /
        Math.max(0.55, away.defence * 0.68 + away.midfield * 0.32)) *
      (1 + homeAdv) *
      homeFatigue;

    const awayChance =
      0.038 *
      BLOCK *
      ((away.attack * 0.62 + away.midfield * 0.38) /
        Math.max(0.55, home.defence * 0.68 + home.midfield * 0.32)) *
      awayFatigue;

    // Allow multi-goal blocks via small poisson-like repeats
    let hc = homeChance;
    while (hc > 0.0001 && rng() < Math.min(0.85, hc)) {
      const convert =
        0.29 *
        (home.attack / Math.max(0.55, away.gk * 0.5 + away.defence * 0.5));
      if (rng() < Math.min(0.58, convert)) homeGoals += 1;
      hc *= 0.35;
    }

    let ac = awayChance;
    while (ac > 0.0001 && rng() < Math.min(0.85, ac)) {
      const convert =
        0.27 *
        (away.attack / Math.max(0.55, home.gk * 0.5 + home.defence * 0.5));
      if (rng() < Math.min(0.55, convert)) awayGoals += 1;
      ac *= 0.35;
    }
  }

  return { homeGoals, awayGoals };
}

export function runMatchSimulations(
  match: MatchDetail,
  features: PredictFeatures,
  iterations = DEFAULT_SIM_ITERATIONS,
): SimulationResult {
  const homeUnits = rateSideUnits(match, "home", features);
  const awayUnits = rateSideUnits(match, "away", features);
  const rng = mulberry32(hashSeed(`${match.id}:${iterations}:sim-v2`));

  const scoreCounts = new Map<string, number>();
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let homeGoalsTotal = 0;
  let awayGoalsTotal = 0;
  let btts = 0;
  let over25 = 0;

  for (let i = 0; i < iterations; i += 1) {
    const { homeGoals, awayGoals } = simulateOne(
      homeUnits,
      awayUnits,
      features.home_advantage,
      rng,
    );

    homeGoalsTotal += homeGoals;
    awayGoalsTotal += awayGoals;
    if (homeGoals > awayGoals) homeWins += 1;
    else if (homeGoals === awayGoals) draws += 1;
    else awayWins += 1;
    if (homeGoals > 0 && awayGoals > 0) btts += 1;
    if (homeGoals + awayGoals > 2.5) over25 += 1;

    const key = `${Math.min(homeGoals, 8)}-${Math.min(awayGoals, 8)}`;
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
  }

  const topScorelines = [...scoreCounts.entries()]
    .map(([score, count]) => {
      const [homeGoals, awayGoals] = score.split("-").map(Number);
      return {
        homeGoals,
        awayGoals,
        probability: Number(((count / iterations) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const most = topScorelines[0];

  return {
    iterations,
    homeWinPct: Number(((homeWins / iterations) * 100).toFixed(1)),
    drawPct: Number(((draws / iterations) * 100).toFixed(1)),
    awayWinPct: Number(((awayWins / iterations) * 100).toFixed(1)),
    expectedHomeGoals: Number((homeGoalsTotal / iterations).toFixed(2)),
    expectedAwayGoals: Number((awayGoalsTotal / iterations).toFixed(2)),
    mostLikelyScore: most ? `${most.homeGoals}-${most.awayGoals}` : "1-1",
    topScorelines,
    homeUnits: {
      attack: Number(homeUnits.attack.toFixed(3)),
      midfield: Number(homeUnits.midfield.toFixed(3)),
      defence: Number(homeUnits.defence.toFixed(3)),
      gk: Number(homeUnits.gk.toFixed(3)),
      stamina: Number(homeUnits.stamina.toFixed(3)),
    },
    awayUnits: {
      attack: Number(awayUnits.attack.toFixed(3)),
      midfield: Number(awayUnits.midfield.toFixed(3)),
      defence: Number(awayUnits.defence.toFixed(3)),
      gk: Number(awayUnits.gk.toFixed(3)),
      stamina: Number(awayUnits.stamina.toFixed(3)),
    },
    bttsPct: Number(((btts / iterations) * 100).toFixed(1)),
    over25Pct: Number(((over25 / iterations) * 100).toFixed(1)),
  };
}

export function blendPercents(
  model: { homeWinPct: number; drawPct: number; awayWinPct: number },
  sim: { homeWinPct: number; drawPct: number; awayWinPct: number },
  simWeight = 0.5,
) {
  const modelWeight = 1 - simWeight;
  let home = model.homeWinPct * modelWeight + sim.homeWinPct * simWeight;
  let draw = model.drawPct * modelWeight + sim.drawPct * simWeight;
  let away = model.awayWinPct * modelWeight + sim.awayWinPct * simWeight;
  const total = home + draw + away || 1;
  home = (home / total) * 100;
  draw = (draw / total) * 100;
  away = (away / total) * 100;
  return {
    homeWinPct: Number(home.toFixed(1)),
    drawPct: Number(draw.toFixed(1)),
    awayWinPct: Number(away.toFixed(1)),
  };
}

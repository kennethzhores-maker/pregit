import type { PredictFeatures, ScorelineProbability } from "@/lib/predict/types";

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

function clampLambda(value: number) {
  return Math.min(3.8, Math.max(0.45, value));
}

function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
) {
  if (homeGoals === 0 && awayGoals === 0) {
    return 1 - lambdaHome * lambdaAway * rho;
  }
  if (homeGoals === 0 && awayGoals === 1) {
    return 1 + lambdaHome * rho;
  }
  if (homeGoals === 1 && awayGoals === 0) {
    return 1 + lambdaAway * rho;
  }
  if (homeGoals === 1 && awayGoals === 1) {
    return 1 - rho;
  }
  return 1;
}

export function expectedGoalsFromFeatures(features: PredictFeatures): {
  home: number;
  away: number;
} {
  let home = features.goal_expectancy_raw_home;
  let away = features.goal_expectancy_raw_away;

  home *= 1 + (features.home_form_pts - 7.5) * 0.016;
  away *= 1 + (features.away_form_pts - 7.5) * 0.016;
  home *= 1 + (features.home_home_form_pts - 7.5) * 0.014;
  away *= 1 + (features.away_away_form_pts - 7.5) * 0.014;

  home *= 1 + features.xi_rating_diff * 0.05;
  away *= 1 - features.xi_rating_diff * 0.045;

  home *= 1 + (features.home_attack_xi - 6.9) * 0.04;
  away *= 1 + (features.away_attack_xi - 6.9) * 0.04;
  home *= 1 - (features.away_defence_xi - 6.9) * 0.035;
  away *= 1 - (features.home_defence_xi - 6.9) * 0.035;

  // Stronger positional injury impact
  home *= 1 - features.home_injury_attack_pen;
  away *= 1 - features.away_injury_attack_pen;
  home *= 1 + features.away_injury_defence_pen * 0.55;
  away *= 1 + features.home_injury_defence_pen * 0.55;

  home *= 1 + (features.rest_days_home - 5) * 0.018;
  away *= 1 + (features.rest_days_away - 5) * 0.018;
  home *= 1 - features.congestion_home * 0.05;
  away *= 1 - features.congestion_away * 0.05;

  home *= features.set_piece_home;
  away *= features.set_piece_away;

  if (features.h2h_matches > 0) {
    const w = Math.min(0.28, 0.09 * features.h2h_matches);
    home = home * (1 - w) + features.h2h_avg_home_goals * w;
    away = away * (1 - w) + features.h2h_avg_away_goals * w;
  }

  const ppgDiff = features.home_ppg - features.away_ppg;
  home *= 1 + ppgDiff * 0.035;
  away *= 1 - ppgDiff * 0.03;

  // Lighter mean-reversion so club strength differences stay visible
  home = home * 0.92 + 1.35 * 0.08;
  away = away * 0.92 + 1.2 * 0.08;

  return {
    home: clampLambda(home),
    away: clampLambda(away),
  };
}

export function scoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 6,
  rho = -0.08,
): ScorelineProbability[] {
  const lines: ScorelineProbability[] = [];

  for (let hg = 0; hg <= maxGoals; hg += 1) {
    for (let ag = 0; ag <= maxGoals; ag += 1) {
      const base = poissonPmf(hg, lambdaHome) * poissonPmf(ag, lambdaAway);
      const tau = dixonColesTau(hg, ag, lambdaHome, lambdaAway, rho);
      lines.push({
        homeGoals: hg,
        awayGoals: ag,
        probability: Math.max(0, base * tau),
      });
    }
  }

  const total = lines.reduce((sum, line) => sum + line.probability, 0) || 1;
  return lines
    .map((line) => ({
      ...line,
      probability: line.probability / total,
    }))
    .sort((a, b) => b.probability - a.probability);
}

export function aggregateResult(lines: ScorelineProbability[]) {
  let home = 0;
  let draw = 0;
  let away = 0;

  for (const line of lines) {
    if (line.homeGoals > line.awayGoals) home += line.probability;
    else if (line.homeGoals === line.awayGoals) draw += line.probability;
    else away += line.probability;
  }

  const total = home + draw + away || 1;
  return {
    homeWinPct: (home / total) * 100,
    drawPct: (draw / total) * 100,
    awayWinPct: (away / total) * 100,
  };
}

export function marketProbsFromMatrix(lines: ScorelineProbability[]) {
  let btts = 0;
  let over25 = 0;
  for (const line of lines) {
    if (line.homeGoals > 0 && line.awayGoals > 0) btts += line.probability;
    if (line.homeGoals + line.awayGoals >= 3) over25 += line.probability;
  }
  return {
    bttsPct: btts * 100,
    over25Pct: over25 * 100,
  };
}

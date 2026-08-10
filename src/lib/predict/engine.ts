import type { MatchDetail } from "@/lib/data/types";
import { buildFeatures } from "@/lib/predict/features";
import {
  applyConfidenceGate,
  buildTrustExplanations,
} from "@/lib/predict/explanations";
import {
  applyResultCalibration,
  buildHistoryCalibration,
} from "@/lib/predict/calibration";
import { calibrateMarkets } from "@/lib/predict/markets";
import {
  aggregateResult,
  expectedGoalsFromFeatures,
  scoreMatrix,
} from "@/lib/predict/poisson";
import {
  blendPercents,
  runMatchSimulations,
} from "@/lib/predict/simulate";
import {
  CONFIRMED_SIM_ITERATIONS,
  DEFAULT_SIM_ITERATIONS,
  MODEL_VERSION,
  POISSON_WEIGHT,
  SIM_WEIGHT,
  type MethodBreakdown,
  type PredictionResult,
} from "@/lib/predict/types";

function confidenceFrom(
  features: PredictionResult["features"],
  ensemble: { homeWinPct: number; awayWinPct: number },
  poisson: MethodBreakdown,
  sim: { homeWinPct: number; awayWinPct: number },
  historySample: number,
) {
  let score = 60;
  score += features.lineup_confirmed * 16;
  score += Math.min(10, Math.abs(ensemble.homeWinPct - ensemble.awayWinPct) * 0.35);

  const methodGap = Math.abs(poisson.homeWinPct - sim.homeWinPct);
  score -= Math.min(10, methodGap * 0.22);
  score += Math.min(8, features.h2h_matches * 2);
  score -=
    (features.home_injury_attack_pen + features.away_injury_attack_pen) * 12;
  score -= features.congestion_home * 2 + features.congestion_away * 2;
  score += Math.min(4, historySample * 0.15);

  return Math.round(Math.min(94, Math.max(45, score)));
}

function mergeTopScorelines(
  poisson: MethodBreakdown["topScorelines"],
  sim: MethodBreakdown["topScorelines"],
) {
  const merged = new Map<string, number>();
  for (const line of poisson) {
    const key = `${line.homeGoals}-${line.awayGoals}`;
    merged.set(key, (merged.get(key) ?? 0) + line.probability * POISSON_WEIGHT);
  }
  for (const line of sim) {
    const key = `${line.homeGoals}-${line.awayGoals}`;
    merged.set(key, (merged.get(key) ?? 0) + line.probability * SIM_WEIGHT);
  }

  return [...merged.entries()]
    .map(([score, probability]) => {
      const [homeGoals, awayGoals] = score.split("-").map(Number);
      return {
        homeGoals,
        awayGoals,
        probability: Number(probability.toFixed(2)),
      };
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);
}

function resolveIterations(
  match: MatchDetail,
  requested?: number,
): number {
  if (requested != null) return requested;
  const hours =
    (new Date(match.kickoff).getTime() - Date.now()) / (1000 * 60 * 60);
  if (match.lineupStatus === "confirmed" && hours <= 6) {
    return CONFIRMED_SIM_ITERATIONS;
  }
  return DEFAULT_SIM_ITERATIONS;
}

export function predictMatch(
  match: MatchDetail,
  source: PredictionResult["source"] = "local",
  iterations?: number,
): PredictionResult {
  const features = buildFeatures(match);
  const history = buildHistoryCalibration();
  const runs = resolveIterations(match, iterations);

  const { home, away } = expectedGoalsFromFeatures(features);
  const poissonLines = scoreMatrix(home, away, 6, -0.08);
  const poissonPct = aggregateResult(poissonLines);
  const poissonTop = poissonLines.slice(0, 5).map((line) => ({
    ...line,
    probability: Number((line.probability * 100).toFixed(2)),
  }));
  const poissonMost = poissonLines[0];
  const poisson: MethodBreakdown = {
    homeWinPct: Number(poissonPct.homeWinPct.toFixed(1)),
    drawPct: Number(poissonPct.drawPct.toFixed(1)),
    awayWinPct: Number(poissonPct.awayWinPct.toFixed(1)),
    expectedHomeGoals: Number(home.toFixed(2)),
    expectedAwayGoals: Number(away.toFixed(2)),
    mostLikelyScore: `${poissonMost.homeGoals}-${poissonMost.awayGoals}`,
    topScorelines: poissonTop,
  };

  const simulation = runMatchSimulations(match, features, runs);
  const blendedRaw = blendPercents(poisson, simulation, SIM_WEIGHT);
  const blended = applyResultCalibration(
    blendedRaw.homeWinPct,
    blendedRaw.drawPct,
    blendedRaw.awayWinPct,
    history,
  );

  const topScorelines = mergeTopScorelines(
    poisson.topScorelines,
    simulation.topScorelines,
  );
  const mostLikelyScore = `${topScorelines[0].homeGoals}-${topScorelines[0].awayGoals}`;

  const expectedHomeGoals = Number(
    (
      poisson.expectedHomeGoals * POISSON_WEIGHT +
      simulation.expectedHomeGoals * SIM_WEIGHT
    ).toFixed(2),
  );
  const expectedAwayGoals = Number(
    (
      poisson.expectedAwayGoals * POISSON_WEIGHT +
      simulation.expectedAwayGoals * SIM_WEIGHT
    ).toFixed(2),
  );

  const markets = calibrateMarkets(
    features,
    poissonLines,
    simulation.bttsPct,
    simulation.over25Pct,
    history,
  );

  const rawConfidence = confidenceFrom(
    features,
    blended,
    poisson,
    simulation,
    history.sampleSize,
  );
  const gated = applyConfidenceGate(rawConfidence, match.lineupStatus);

  const prediction: PredictionResult = {
    fixtureId: match.id,
    modelVersion: MODEL_VERSION,
    ...blended,
    expectedHomeGoals,
    expectedAwayGoals,
    mostLikelyScore,
    topScorelines,
    confidence: gated.confidence,
    confidenceReliable: gated.confidenceReliable,
    confidenceNote: gated.confidenceNote,
    reasons: [],
    features,
    source,
    poisson,
    simulation: {
      ...simulation,
      homeWinPct: simulation.homeWinPct,
      drawPct: simulation.drawPct,
      awayWinPct: simulation.awayWinPct,
      expectedHomeGoals: simulation.expectedHomeGoals,
      expectedAwayGoals: simulation.expectedAwayGoals,
      mostLikelyScore: simulation.mostLikelyScore,
      topScorelines: simulation.topScorelines,
    },
    ensembleWeights: {
      poisson: POISSON_WEIGHT,
      simulation: SIM_WEIGHT,
    },
    markets,
  };

  prediction.reasons = [
    history.note,
    `Monte Carlo runs: ${runs.toLocaleString()}.`,
    ...buildTrustExplanations(match, prediction),
  ].slice(0, 8);

  return prediction;
}

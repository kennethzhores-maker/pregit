import type { PredictFeatures, ScorelineProbability } from "@/lib/predict/types";
import { marketProbsFromMatrix } from "@/lib/predict/poisson";

export type CalibratedMarkets = {
  bttsPct: number;
  over25Pct: number;
  under25Pct: number;
  bttsLean: "yes" | "no";
  over25Lean: "over" | "under";
};

/**
 * Blend poisson matrix markets with simulation frequencies and H2H priors.
 * Tuned against Phase 7 weak spots (BTTS / O2.5).
 */
export function calibrateMarkets(
  features: PredictFeatures,
  poissonLines: ScorelineProbability[],
  simBttsPct: number,
  simOver25Pct: number,
): CalibratedMarkets {
  const matrix = marketProbsFromMatrix(poissonLines);

  let btts =
    matrix.bttsPct * 0.45 +
    simBttsPct * 0.4 +
    (features.h2h_matches > 0 ? features.h2h_btts_rate * 100 : 52) * 0.15;

  let over25 =
    matrix.over25Pct * 0.45 +
    simOver25Pct * 0.4 +
    (features.h2h_matches > 0 ? features.h2h_over25_rate * 100 : 48) * 0.15;

  // Open games (high combined attack styles) lift both markets
  const openness =
    (features.home_style_attack + features.away_style_attack) / 2;
  btts += (openness - 1) * 12;
  over25 += (openness - 1) * 14;

  // Defensive blocks suppress
  const block = (features.home_style_block + features.away_style_block) / 2;
  btts -= (block - 1) * 10;
  over25 -= (block - 1) * 12;

  // Injury-hit attacks reduce BTTS more than O/U
  btts -= (features.home_injury_attack_pen + features.away_injury_attack_pen) * 18;

  btts = Math.min(78, Math.max(28, btts));
  over25 = Math.min(80, Math.max(26, over25));

  return {
    bttsPct: Number(btts.toFixed(1)),
    over25Pct: Number(over25.toFixed(1)),
    under25Pct: Number((100 - over25).toFixed(1)),
    bttsLean: btts >= 50 ? "yes" : "no",
    over25Lean: over25 >= 50 ? "over" : "under",
  };
}

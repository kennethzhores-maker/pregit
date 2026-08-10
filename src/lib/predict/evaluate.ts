import type {
  MarketEvaluation,
  PredictedResult,
  PredictionRecord,
} from "@/lib/predict/types";

function actualResult(
  homeScore: number,
  awayScore: number,
): PredictedResult {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

export function evaluatePredictionAgainstScore(
  predictedResult: PredictedResult,
  mostLikelyScore: string,
  bttsPct: number,
  over25Pct: number,
  homeScore: number,
  awayScore: number,
): MarketEvaluation[] {
  const [predHome, predAway] = mostLikelyScore.split("-").map(Number);
  const actual = actualResult(homeScore, awayScore);
  const actualBtts = homeScore > 0 && awayScore > 0;
  const predictedBtts = bttsPct >= 50;
  const actualOver25 = homeScore + awayScore > 2.5;
  const predictedOver25 = over25Pct >= 50;

  return [
    {
      market: "result",
      predicted: predictedResult,
      actual,
      correct: predictedResult === actual,
    },
    {
      market: "btts",
      predicted: predictedBtts ? "yes" : "no",
      actual: actualBtts ? "yes" : "no",
      correct: predictedBtts === actualBtts,
    },
    {
      market: "over25",
      predicted: predictedOver25 ? "over" : "under",
      actual: actualOver25 ? "over" : "under",
      correct: predictedOver25 === actualOver25,
    },
    {
      market: "exact_score",
      predicted: mostLikelyScore,
      actual: `${homeScore}-${awayScore}`,
      correct: predHome === homeScore && predAway === awayScore,
    },
  ];
}

export function attachActualScore(
  record: PredictionRecord,
  homeScore: number,
  awayScore: number,
): PredictionRecord {
  const markets = evaluatePredictionAgainstScore(
    record.predictedResult,
    record.mostLikelyScore,
    record.bttsPct,
    record.over25Pct,
    homeScore,
    awayScore,
  );

  return {
    ...record,
    actualHomeScore: homeScore,
    actualAwayScore: awayScore,
    evaluatedAt: new Date().toISOString(),
    markets,
    resultCorrect: markets.find((m) => m.market === "result")?.correct ?? null,
  };
}

import {
  getAccuracySummary,
  listPredictionHistory,
} from "../src/lib/predict/history";
import { predictMatch } from "../src/lib/predict/engine";
import { getSeedMatchDetail } from "../src/lib/data/seed";
import { MODEL_VERSION } from "../src/lib/predict/types";

async function main() {
  const history = listPredictionHistory();
  const accuracy = getAccuracySummary(history);
  const livChe = getSeedMatchDetail("fx-001");
  const prediction = livChe
    ? predictMatch({ ...livChe, lineupStatus: "confirmed", status: "lineups" })
    : null;

  console.log(
    JSON.stringify(
      {
        modelVersion: MODEL_VERSION,
        trustStatement: accuracy.statement,
        markets: {
          result: accuracy.resultAccuracyPct,
          btts: accuracy.bttsAccuracyPct,
          over25: accuracy.over25AccuracyPct,
          exact: accuracy.exactScoreAccuracyPct,
        },
        samples: {
          total: accuracy.sampleSize,
          evaluated: accuracy.evaluatedCount,
        },
        samplePrediction: prediction
          ? {
              fixture: "Liverpool vs Chelsea",
              lean: [
                prediction.homeWinPct,
                prediction.drawPct,
                prediction.awayWinPct,
              ],
              score: prediction.mostLikelyScore,
              xg: [
                prediction.expectedHomeGoals,
                prediction.expectedAwayGoals,
              ],
              calibrated: prediction.markets,
              featureHighlights: {
                xiDiff: prediction.features.xi_rating_diff,
                rest: [
                  prediction.features.rest_days_home,
                  prediction.features.rest_days_away,
                ],
                injuryAtk: [
                  prediction.features.home_injury_attack_pen,
                  prediction.features.away_injury_attack_pen,
                ],
                setPiece: [
                  prediction.features.set_piece_home,
                  prediction.features.set_piece_away,
                ],
              },
            }
          : null,
        latestHistory: history.slice(0, 4).map((row) => ({
          match: `${row.homeName} vs ${row.awayName}`,
          predicted: row.mostLikelyScore,
          actual:
            row.actualHomeScore == null
              ? null
              : `${row.actualHomeScore}-${row.actualAwayScore}`,
          resultHit: row.resultCorrect,
          btts: row.markets.find((m) => m.market === "btts")?.correct ?? null,
          over25: row.markets.find((m) => m.market === "over25")?.correct ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

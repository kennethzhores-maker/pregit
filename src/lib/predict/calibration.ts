import type { PredictionRecord } from "@/lib/predict/types";
import { listPredictionHistory } from "@/lib/predict/history";

export type HistoryCalibration = {
  sampleSize: number;
  /** Additive correction on home-win probability (percentage points). */
  homeBias: number;
  drawBias: number;
  awayBias: number;
  /** Multipliers on market probs before clamp (1 = unchanged). */
  bttsMultiplier: number;
  over25Multiplier: number;
  note: string;
};

const DEFAULT: HistoryCalibration = {
  sampleSize: 0,
  homeBias: 0,
  drawBias: 0,
  awayBias: 0,
  bttsMultiplier: 1,
  over25Multiplier: 1,
  note: "No settled history yet — using base calibration.",
};

/**
 * Derive simple bias corrections from settled prediction history.
 * If we over-predicted home wins, shrink home and lift draw/away, etc.
 */
export function buildHistoryCalibration(
  records: PredictionRecord[] = listPredictionHistory(),
): HistoryCalibration {
  const evaluated = records.filter((r) => r.evaluatedAt && r.markets.length);
  if (evaluated.length < 4) {
    return {
      ...DEFAULT,
      sampleSize: evaluated.length,
      note:
        evaluated.length === 0
          ? DEFAULT.note
          : `Only ${evaluated.length} settled predicts — light history prior.`,
    };
  }

  let predHome = 0;
  let predDraw = 0;
  let predAway = 0;
  let actHome = 0;
  let actDraw = 0;
  let actAway = 0;
  let bttsPredYes = 0;
  let bttsActYes = 0;
  let overPred = 0;
  let overAct = 0;

  for (const row of evaluated) {
    if (row.predictedResult === "home") predHome += 1;
    else if (row.predictedResult === "draw") predDraw += 1;
    else predAway += 1;

    const hg = row.actualHomeScore ?? 0;
    const ag = row.actualAwayScore ?? 0;
    if (hg > ag) actHome += 1;
    else if (hg === ag) actDraw += 1;
    else actAway += 1;

    const btts = row.markets.find((m) => m.market === "btts");
    if (btts) {
      if (btts.predicted === "yes") bttsPredYes += 1;
      if (btts.actual === "yes") bttsActYes += 1;
    }
    const over = row.markets.find((m) => m.market === "over25");
    if (over) {
      if (over.predicted === "over") overPred += 1;
      if (over.actual === "over") overAct += 1;
    }
  }

  const n = evaluated.length;
  const homeGap = predHome / n - actHome / n;
  const drawGap = predDraw / n - actDraw / n;
  const awayGap = predAway / n - actAway / n;

  // If we predicted home too often vs reality, push probability away from home
  const homeBias = Number((-homeGap * 12).toFixed(2));
  const drawBias = Number((-drawGap * 10).toFixed(2));
  const awayBias = Number((-awayGap * 12).toFixed(2));

  const bttsRatePred = bttsPredYes / Math.max(1, n);
  const bttsRateAct = bttsActYes / Math.max(1, n);
  const overRatePred = overPred / Math.max(1, n);
  const overRateAct = overAct / Math.max(1, n);

  const bttsMultiplier = Number(
    Math.min(1.18, Math.max(0.85, 1 + (bttsRateAct - bttsRatePred) * 0.9)).toFixed(
      3,
    ),
  );
  const over25Multiplier = Number(
    Math.min(1.18, Math.max(0.85, 1 + (overRateAct - overRatePred) * 0.9)).toFixed(
      3,
    ),
  );

  return {
    sampleSize: n,
    homeBias,
    drawBias,
    awayBias,
    bttsMultiplier,
    over25Multiplier,
    note: `History calibration on ${n} settled predicts (home bias ${homeBias >= 0 ? "+" : ""}${homeBias}pp).`,
  };
}

export function applyResultCalibration(
  homeWinPct: number,
  drawPct: number,
  awayWinPct: number,
  cal: HistoryCalibration,
) {
  let home = homeWinPct + cal.homeBias;
  let draw = drawPct + cal.drawBias;
  let away = awayWinPct + cal.awayBias;

  home = Math.max(5, home);
  draw = Math.max(5, draw);
  away = Math.max(5, away);
  const sum = home + draw + away;
  home = (home / sum) * 100;
  draw = (draw / sum) * 100;
  away = (away / sum) * 100;

  return {
    homeWinPct: Number(home.toFixed(1)),
    drawPct: Number(draw.toFixed(1)),
    awayWinPct: Number(away.toFixed(1)),
  };
}

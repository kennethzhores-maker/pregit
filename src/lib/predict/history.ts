import { createHash } from "node:crypto";

import { FIXTURES } from "@/lib/data/seed";
import { attachActualScore } from "@/lib/predict/evaluate";
import { pickPredictedResult } from "@/lib/predict/explanations";
import type {
  AccuracySummary,
  PredictionRecord,
  PredictionResult,
} from "@/lib/predict/types";
import { createServiceClient } from "@/lib/supabase/admin";

const memoryStore: PredictionRecord[] = [];

function makeId(fixtureId: string, createdAt: string) {
  return createHash("sha1")
    .update(`${fixtureId}:${createdAt}`)
    .digest("hex")
    .slice(0, 12);
}

export function predictionToRecord(
  match: {
    id: string;
    home: { name: string };
    away: { name: string };
    kickoff: string;
    lineupStatus: string;
    homeScore: number | null;
    awayScore: number | null;
  },
  prediction: PredictionResult,
): PredictionRecord {
  const createdAt = new Date().toISOString();
  let record: PredictionRecord = {
    id: makeId(match.id, createdAt),
    fixtureId: match.id,
    homeName: match.home.name,
    awayName: match.away.name,
    kickoff: match.kickoff,
    createdAt,
    modelVersion: prediction.modelVersion,
    predictedResult: pickPredictedResult(
      prediction.homeWinPct,
      prediction.drawPct,
      prediction.awayWinPct,
    ),
    homeWinPct: prediction.homeWinPct,
    drawPct: prediction.drawPct,
    awayWinPct: prediction.awayWinPct,
    mostLikelyScore: prediction.mostLikelyScore,
    expectedHomeGoals: prediction.expectedHomeGoals,
    expectedAwayGoals: prediction.expectedAwayGoals,
    bttsPct: prediction.markets?.bttsPct ?? prediction.simulation.bttsPct,
    over25Pct: prediction.markets?.over25Pct ?? prediction.simulation.over25Pct,
    confidence: prediction.confidence,
    confidenceReliable: prediction.confidenceReliable,
    confidenceNote: prediction.confidenceNote,
    lineupStatus: prediction.refresh?.lineupStatus ?? match.lineupStatus,
    reasons: prediction.reasons,
    actualHomeScore: null,
    actualAwayScore: null,
    evaluatedAt: null,
    markets: [],
    resultCorrect: null,
  };

  if (match.homeScore != null && match.awayScore != null) {
    record = attachActualScore(record, match.homeScore, match.awayScore);
  }

  return record;
}

export function savePredictionRecord(record: PredictionRecord) {
  if (!record.evaluatedAt) {
    const openIdx = memoryStore.findIndex(
      (row) => row.fixtureId === record.fixtureId && !row.evaluatedAt,
    );
    if (openIdx >= 0) memoryStore.splice(openIdx, 1, record);
    else memoryStore.unshift(record);
    return;
  }

  const existing = memoryStore.findIndex((row) => row.id === record.id);
  if (existing >= 0) memoryStore.splice(existing, 1, record);
  else memoryStore.unshift(record);
}

export async function persistPredictionRecord(record: PredictionRecord) {
  savePredictionRecord(record);

  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase.from("prediction_history").upsert(
    {
      id: record.id,
      fixture_id: record.fixtureId,
      model_version: record.modelVersion,
      predicted_result: record.predictedResult,
      home_win_pct: record.homeWinPct,
      draw_pct: record.drawPct,
      away_win_pct: record.awayWinPct,
      most_likely_score: record.mostLikelyScore,
      expected_home_goals: record.expectedHomeGoals,
      expected_away_goals: record.expectedAwayGoals,
      btts_pct: record.bttsPct,
      over25_pct: record.over25Pct,
      confidence: record.confidence,
      confidence_reliable: record.confidenceReliable,
      lineup_status: record.lineupStatus,
      reasons: record.reasons,
      actual_home_score: record.actualHomeScore,
      actual_away_score: record.actualAwayScore,
      evaluated_at: record.evaluatedAt,
      markets: record.markets,
      result_correct: record.resultCorrect,
      created_at: record.createdAt,
      home_name: record.homeName,
      away_name: record.awayName,
      kickoff: record.kickoff,
    },
    { onConflict: "id" },
  );
}

function seedDemoHistory() {
  // Demo ledger disabled — History/Accuracy only show predicts you actually run.
  return;
}

export function listPredictionHistory(): PredictionRecord[] {
  return [...memoryStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function pct(correct: number, total: number) {
  if (!total) return null;
  return Number(((correct / total) * 100).toFixed(1));
}

export function getAccuracySummary(
  records: PredictionRecord[] = listPredictionHistory(),
): AccuracySummary {
  const evaluated = records.filter((r) => r.evaluatedAt && r.markets.length);
  const pending = records.filter((r) => !r.evaluatedAt);

  const resultHits = evaluated.filter((r) =>
    r.markets.some((m) => m.market === "result" && m.correct),
  ).length;
  const bttsHits = evaluated.filter((r) =>
    r.markets.some((m) => m.market === "btts" && m.correct),
  ).length;
  const overHits = evaluated.filter((r) =>
    r.markets.some((m) => m.market === "over25" && m.correct),
  ).length;
  const exactHits = evaluated.filter((r) =>
    r.markets.some((m) => m.market === "exact_score" && m.correct),
  ).length;

  const reliable = evaluated.filter((r) => r.confidenceReliable);
  const reliableHits = reliable.filter((r) =>
    r.markets.some((m) => m.market === "result" && m.correct),
  ).length;

  const resultAccuracyPct = pct(resultHits, evaluated.length);
  const statement =
    evaluated.length === 0
      ? "No evaluated predictions yet — predict fixtures and settle results to build the ledger."
      : `We're ${resultAccuracyPct}% accurate on match result over the last ${evaluated.length} evaluated prediction${evaluated.length === 1 ? "" : "s"}.`;

  const avgConfidence =
    evaluated.length === 0
      ? null
      : Number(
          (
            evaluated.reduce((sum, row) => sum + row.confidence, 0) /
            evaluated.length
          ).toFixed(1),
        );

  return {
    sampleSize: records.length,
    evaluatedCount: evaluated.length,
    pendingCount: pending.length,
    resultAccuracyPct,
    bttsAccuracyPct: pct(bttsHits, evaluated.length),
    over25AccuracyPct: pct(overHits, evaluated.length),
    exactScoreAccuracyPct: pct(exactHits, evaluated.length),
    avgConfidence,
    reliableSampleSize: reliable.length,
    reliableResultAccuracyPct: pct(reliableHits, reliable.length),
    statement,
  };
}

export async function reevaluateFinishedPredictions() {
  const finished = new Map(
    FIXTURES.filter(
      (f) => f.status === "finished" && f.homeScore != null && f.awayScore != null,
    ).map((f) => [f.id, f]),
  );

  for (let i = 0; i < memoryStore.length; i += 1) {
    const row = memoryStore[i];
    const fixture = finished.get(row.fixtureId);
    if (!fixture || row.evaluatedAt) continue;
    memoryStore[i] = attachActualScore(
      row,
      fixture.homeScore as number,
      fixture.awayScore as number,
    );
  }
}

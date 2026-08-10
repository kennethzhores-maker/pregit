import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { predictMatch } from "@/lib/predict/engine";
import {
  persistPredictionRecord,
  predictionToRecord,
} from "@/lib/predict/history";
import { buildMatchTimeline } from "@/lib/predict/timeline";
import type { PredictionResult } from "@/lib/predict/types";
import { recordHealthEvent } from "@/lib/product/admin-health";
import { gatePredictionForPlan, getUserPlan } from "@/lib/product/plans";
import {
  consumePredictCredit,
  getPredictUsage,
} from "@/lib/product/usage";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  refreshMatchForKickoff,
  type MatchRefreshResult,
} from "@/lib/sync/pre-kickoff";

function snapshotHash(
  matchId: string,
  refresh: MatchRefreshResult,
  homeIds: string[],
  awayIds: string[],
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        matchId,
        refreshedAt: refresh.refreshedAt,
        homeIds,
        awayIds,
        injuries: refresh.injuryCount,
        lineupStatus: refresh.lineupStatus,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

function usagePayload(usage: Awaited<ReturnType<typeof getPredictUsage>>) {
  return {
    limit: usage.unlimited ? -1 : usage.limit,
    remaining: usage.unlimited ? -1 : usage.remaining,
    count: usage.count,
    plan: usage.plan,
    unlimited: usage.unlimited,
  };
}

async function predictViaAiEngine(
  features: PredictionResult["features"],
  fixtureId: string,
): Promise<PredictionResult | null> {
  const baseUrl = process.env.AI_ENGINE_URL;
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixture_id: fixtureId,
        features,
        iterations: 10000,
      }),
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = (await response.json()) as PredictionResult;
    return { ...data, source: "ai-engine" };
  } catch {
    return null;
  }
}

async function persistPrediction(
  prediction: PredictionResult,
  userId: string | null,
) {
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase.from("predictions").insert({
    fixture_id: prediction.fixtureId,
    user_id: userId && userId !== "demo-user" ? userId : null,
    model_version: prediction.modelVersion,
    home_win_pct: prediction.homeWinPct,
    draw_pct: prediction.drawPct,
    away_win_pct: prediction.awayWinPct,
    predicted_home_goals: prediction.expectedHomeGoals,
    predicted_away_goals: prediction.expectedAwayGoals,
    most_likely_score: prediction.mostLikelyScore,
    confidence: prediction.confidence,
    lineup_status: prediction.refresh?.lineupStatus ?? null,
    snapshot_hash: prediction.refresh?.snapshotHash ?? null,
    refresh_meta: prediction.refresh ?? null,
    explanation: {
      reasons: prediction.reasons,
      topScorelines: prediction.topScorelines,
      poisson: prediction.poisson,
      simulation: prediction.simulation,
      ensembleWeights: prediction.ensembleWeights,
      timeline: prediction.timeline,
    },
    inputs_snapshot: {
      features: prediction.features,
      refresh: prediction.refresh,
      homeXi: prediction.refresh?.homeXiCount,
      awayXi: prediction.refresh?.awayXiCount,
    },
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [usage, plan] = await Promise.all([
    getPredictUsage(user.id),
    getUserPlan(user.id),
  ]);
  return NextResponse.json({
    usage: usagePayload(usage),
    plan: {
      id: plan.plan,
      label: plan.label,
      entitlements: {
        fullSimulation: plan.fullSimulation,
        timeline: plan.timeline,
        fullExplanations: plan.fullExplanations,
        unlimitedPredicts: plan.unlimitedPredicts,
        historyAccess: plan.historyAccess,
        accuracyAccess: plan.accuracyAccess,
      },
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getUserPlan(user.id);
  const usage = await getPredictUsage(user.id);
  if (!usage.allowed) {
    recordHealthEvent("error", "Daily predict limit reached", {
      userId: user.id,
      limit: usage.limit,
      plan: plan.plan,
    });
    return NextResponse.json(
      {
        error: `Daily free limit reached (${usage.limit}/day). Upgrade to Pro for unlimited predicts.`,
        usage: usagePayload(usage),
        plan: plan.plan,
      },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    fixtureId?: string;
    skipRefresh?: boolean;
  };

  if (!body.fixtureId) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  let match;
  let refresh: MatchRefreshResult | null = null;

  try {
    if (body.skipRefresh) {
      const { getMatchDetail } = await import("@/lib/data/repository");
      match = await getMatchDetail(body.fixtureId);
      if (!match) {
        return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
      }
    } else {
      const refreshed = await refreshMatchForKickoff(body.fixtureId);
      match = refreshed.match;
      refresh = refreshed.refresh;
      recordHealthEvent("refresh", `Refreshed ${body.fixtureId}`, {
        source: refresh.source,
        lineupStatus: refresh.lineupStatus,
      });
    }
  } catch {
    recordHealthEvent("error", `Refresh failed for ${body.fixtureId}`);
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  const local = predictMatch(match, "local");
  const remote = await predictViaAiEngine(local.features, match.id);
  const full: PredictionResult = remote
    ? {
        ...local,
        ...remote,
        confidenceReliable:
          remote.confidenceReliable ?? local.confidenceReliable,
        confidenceNote: remote.confidenceNote ?? local.confidenceNote,
        reasons: remote.reasons?.length ? remote.reasons : local.reasons,
        poisson: remote.poisson ?? local.poisson,
        simulation: remote.simulation ?? local.simulation,
        ensembleWeights: remote.ensembleWeights ?? local.ensembleWeights,
        markets: remote.markets ?? local.markets,
      }
    : local;

  if (refresh) {
    const hash = snapshotHash(
      match.id,
      refresh,
      match.homeLineup.map((p) => p.playerId),
      match.awayLineup.map((p) => p.playerId),
    );
    full.refresh = {
      ...refresh,
      snapshotHash: hash,
    };
    full.reasons = [
      `Pre-kickoff refresh (${refresh.source}) at ${new Date(refresh.refreshedAt).toLocaleTimeString()} — XI ${refresh.homeXiCount}/${refresh.awayXiCount}, ${refresh.injuryCount} absences.`,
      ...full.reasons,
    ].slice(0, 8);
  }

  full.timeline = buildMatchTimeline(match, full);

  // Persist full fidelity before Free gating
  await persistPrediction(full, user.id);
  await persistPredictionRecord(predictionToRecord(match, full));

  const nextUsage = await consumePredictCredit(user.id);
  const prediction = gatePredictionForPlan(full, plan.plan);
  prediction.usage = usagePayload(nextUsage);

  recordHealthEvent("predict", `Predicted ${match.home.name} vs ${match.away.name}`, {
    fixtureId: match.id,
    score: full.mostLikelyScore,
    model: full.modelVersion,
    plan: plan.plan,
  });

  return NextResponse.json(prediction);
}

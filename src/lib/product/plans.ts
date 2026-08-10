import { cookies } from "next/headers";

import {
  FREE_DAILY_PREDICT_LIMIT,
  FREE_REASON_LIMIT,
  FREE_TOP_SCORELINES,
  PLAN_COOKIE,
  PRO_DAILY_PREDICT_LIMIT,
} from "@/lib/product/config";
import type { PredictionResult } from "@/lib/predict/types";

export type PlanId = "free" | "pro";

export type PlanEntitlements = {
  plan: PlanId;
  dailyPredictLimit: number;
  unlimitedPredicts: boolean;
  fullSimulation: boolean;
  timeline: boolean;
  fullExplanations: boolean;
  historyAccess: boolean;
  accuracyAccess: boolean;
};

export type PlanState = PlanEntitlements & {
  label: string;
  /** Demo billing: cookie upgrade, not a real payment processor. */
  billingMode: "demo";
};

const memoryPlans = new Map<string, PlanId>();

export function entitlementsFor(plan: PlanId): PlanEntitlements {
  if (plan === "pro") {
    return {
      plan: "pro",
      dailyPredictLimit: PRO_DAILY_PREDICT_LIMIT,
      unlimitedPredicts: true,
      fullSimulation: true,
      timeline: true,
      fullExplanations: true,
      historyAccess: true,
      accuracyAccess: true,
    };
  }

  return {
    plan: "free",
    dailyPredictLimit: FREE_DAILY_PREDICT_LIMIT,
    unlimitedPredicts: false,
    fullSimulation: false,
    timeline: false,
    fullExplanations: false,
    historyAccess: false,
    accuracyAccess: false,
  };
}

function parsePlan(raw: string | undefined): PlanId {
  return raw === "pro" ? "pro" : "free";
}

export async function getUserPlan(userId: string): Promise<PlanState> {
  const mem = memoryPlans.get(userId);
  if (mem) {
    const entitlements = entitlementsFor(mem);
    return {
      ...entitlements,
      label: mem === "pro" ? "Pro" : "Free",
      billingMode: "demo",
    };
  }

  const cookieStore = await cookies();
  const plan = parsePlan(cookieStore.get(PLAN_COOKIE)?.value);
  memoryPlans.set(userId, plan);
  const entitlements = entitlementsFor(plan);
  return {
    ...entitlements,
    label: plan === "pro" ? "Pro" : "Free",
    billingMode: "demo",
  };
}

export async function setUserPlan(userId: string, plan: PlanId): Promise<PlanState> {
  memoryPlans.set(userId, plan);
  const cookieStore = await cookies();
  cookieStore.set(PLAN_COOKIE, plan, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  const entitlements = entitlementsFor(plan);
  return {
    ...entitlements,
    label: plan === "pro" ? "Pro" : "Free",
    billingMode: "demo",
  };
}

/**
 * Strip Pro-only detail from a prediction for Free responses.
 * Full payload is still persisted server-side before this runs.
 */
export function gatePredictionForPlan(
  prediction: PredictionResult,
  plan: PlanId,
): PredictionResult {
  const entitlements = entitlementsFor(plan);
  const gated: PredictionResult = {
    ...prediction,
    plan,
    entitlements: {
      fullSimulation: entitlements.fullSimulation,
      timeline: entitlements.timeline,
      fullExplanations: entitlements.fullExplanations,
      unlimitedPredicts: entitlements.unlimitedPredicts,
    },
  };

  if (plan === "pro") return gated;

  return {
    ...gated,
    reasons: prediction.reasons.slice(0, FREE_REASON_LIMIT),
    topScorelines: prediction.topScorelines.slice(0, FREE_TOP_SCORELINES),
    timeline: undefined,
    // Keep headline ensemble probs; hide method/unit depth for Free
    poisson: {
      ...prediction.poisson,
      topScorelines: prediction.poisson.topScorelines.slice(0, 1),
    },
    simulation: {
      ...prediction.simulation,
      topScorelines: prediction.simulation.topScorelines.slice(0, 1),
      homeUnits: {
        attack: 0,
        midfield: 0,
        defence: 0,
        gk: 0,
        stamina: 0,
      },
      awayUnits: {
        attack: 0,
        midfield: 0,
        defence: 0,
        gk: 0,
        stamina: 0,
      },
    },
  };
}

export const MONETIZE_DISCLAIMER =
  "Pregit sells probabilities and most-likely scorelines — not guaranteed exact scores.";

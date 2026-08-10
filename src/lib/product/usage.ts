import { cookies } from "next/headers";

import {
  FREE_DAILY_PREDICT_LIMIT,
  PRO_DAILY_PREDICT_LIMIT,
  USAGE_COOKIE_PREFIX,
  todayKey,
} from "@/lib/product/config";
import { getUserPlan, type PlanId } from "@/lib/product/plans";

export type UsageState = {
  date: string;
  count: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  plan: PlanId;
  unlimited: boolean;
};

const memoryUsage = new Map<string, { date: string; count: number }>();

function usageKey(userId: string) {
  return `${USAGE_COOKIE_PREFIX}${userId}`;
}

async function readCount(userId: string, date: string): Promise<number> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(usageKey(userId))?.value;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { date?: string; count?: number };
      if (parsed.date === date) return parsed.count ?? 0;
    } catch {
      return 0;
    }
  }

  const mem = memoryUsage.get(userId);
  if (mem?.date === date) return mem.count;
  return 0;
}

export async function getPredictUsage(userId: string): Promise<UsageState> {
  const date = todayKey();
  const planState = await getUserPlan(userId);
  const count = await readCount(userId, date);

  if (planState.unlimitedPredicts) {
    return {
      date,
      count,
      limit: PRO_DAILY_PREDICT_LIMIT,
      remaining: PRO_DAILY_PREDICT_LIMIT,
      allowed: true,
      plan: "pro",
      unlimited: true,
    };
  }

  const limit = FREE_DAILY_PREDICT_LIMIT;
  return {
    date,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    allowed: count < limit,
    plan: "free",
    unlimited: false,
  };
}

export async function consumePredictCredit(userId: string): Promise<UsageState> {
  const current = await getPredictUsage(userId);
  if (!current.allowed) return current;

  // Pro still tracks count for admin stats, but never blocks
  const next = {
    date: current.date,
    count: current.count + 1,
  };
  memoryUsage.set(userId, next);

  const cookieStore = await cookies();
  cookieStore.set(usageKey(userId), JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 36,
  });

  if (current.unlimited) {
    return {
      ...current,
      count: next.count,
      remaining: PRO_DAILY_PREDICT_LIMIT,
      allowed: true,
    };
  }

  return {
    ...current,
    count: next.count,
    remaining: Math.max(0, current.limit - next.count),
    allowed: next.count < current.limit,
  };
}

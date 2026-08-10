export const FREE_DAILY_PREDICT_LIMIT = Number(
  process.env.FREE_DAILY_PREDICT_LIMIT ?? 8,
);

/** Pro is unlimited in-product; kept numeric for UI (“∞”). */
export const PRO_DAILY_PREDICT_LIMIT = Number.POSITIVE_INFINITY;

export const FOLLOW_COOKIE = "fp_followed_teams";
export const USAGE_COOKIE_PREFIX = "fp_predict_usage_";
export const PLAN_COOKIE = "fp_plan";

export const FREE_REASON_LIMIT = 2;
export const FREE_TOP_SCORELINES = 1;

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

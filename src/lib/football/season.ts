/**
 * API-Football season = competition start year.
 * On 9 Sep 2026 the live PL season is 2026/27 → 2026.
 * Free plans typically only allow 2022–2024.
 */

export const FREE_PLAN_MAX_SEASON = 2024;
export const PRIOR_STRENGTH_SEASON = 2024;

/** Infer PL season start year from "today". */
export function inferCurrentPlSeason(now = new Date()): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  // Aug–Dec: new season year; Jan–Jul: previous calendar year's start
  return month >= 7 ? year : year - 1;
}

export function getConfiguredFootballSeason(): number {
  const raw = process.env.FOOTBALL_SEASON?.trim();
  if (raw && /^\d{4}$/.test(raw)) return Number(raw);
  return inferCurrentPlSeason();
}

/** Preferred season first, then prior strength season for free-plan fallback. */
export function footballSeasonCandidates(): number[] {
  const preferred = getConfiguredFootballSeason();
  const out = [preferred];
  if (preferred !== PRIOR_STRENGTH_SEASON) {
    out.push(PRIOR_STRENGTH_SEASON);
  }
  if (!out.includes(FREE_PLAN_MAX_SEASON)) {
    out.push(FREE_PLAN_MAX_SEASON);
  }
  return [...new Set(out)];
}

export function isSeasonPlanError(errors: unknown): boolean {
  const text =
    typeof errors === "string"
      ? errors
      : errors == null
        ? ""
        : JSON.stringify(errors);
  return /free plans do not have access to this season|try from 2022 to 2024/i.test(
    text,
  );
}

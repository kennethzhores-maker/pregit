import type { FormResult, TeamStats } from "@/lib/data/types";
import { parseForm } from "@/lib/data/types";
import { PRIOR_STRENGTH_SEASON } from "@/lib/football/season";

export type TeamStrengthPrior = {
  apiTeamId: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  form: string;
};

/** 2024/25 Premier League final table — used when live season stats are missing. */
export const PL_2024_STRENGTH_PRIORS: TeamStrengthPrior[] = [
  { apiTeamId: 40, name: "Liverpool", played: 38, wins: 25, draws: 9, losses: 4, goalsFor: 86, goalsAgainst: 41, form: "DLDLW" },
  { apiTeamId: 42, name: "Arsenal", played: 38, wins: 20, draws: 14, losses: 4, goalsFor: 69, goalsAgainst: 34, form: "WWDLD" },
  { apiTeamId: 50, name: "Manchester City", played: 38, wins: 21, draws: 8, losses: 9, goalsFor: 72, goalsAgainst: 44, form: "WWDWW" },
  { apiTeamId: 49, name: "Chelsea", played: 38, wins: 20, draws: 9, losses: 9, goalsFor: 64, goalsAgainst: 43, form: "WWLWW" },
  { apiTeamId: 34, name: "Newcastle", played: 38, wins: 20, draws: 6, losses: 12, goalsFor: 68, goalsAgainst: 47, form: "LLWDW" },
  { apiTeamId: 66, name: "Aston Villa", played: 38, wins: 19, draws: 9, losses: 10, goalsFor: 58, goalsAgainst: 51, form: "LWWWL" },
  { apiTeamId: 65, name: "Nottingham Forest", played: 38, wins: 19, draws: 8, losses: 11, goalsFor: 58, goalsAgainst: 46, form: "LWDDL" },
  { apiTeamId: 51, name: "Brighton", played: 38, wins: 16, draws: 13, losses: 9, goalsFor: 66, goalsAgainst: 59, form: "WWWDW" },
  { apiTeamId: 35, name: "Bournemouth", played: 38, wins: 15, draws: 11, losses: 12, goalsFor: 58, goalsAgainst: 46, form: "WLLWD" },
  { apiTeamId: 55, name: "Brentford", played: 38, wins: 16, draws: 8, losses: 14, goalsFor: 66, goalsAgainst: 57, form: "DLWWW" },
  { apiTeamId: 36, name: "Fulham", played: 38, wins: 15, draws: 9, losses: 14, goalsFor: 54, goalsAgainst: 54, form: "LWLLW" },
  { apiTeamId: 52, name: "Crystal Palace", played: 38, wins: 13, draws: 14, losses: 11, goalsFor: 51, goalsAgainst: 51, form: "DWWDD" },
  { apiTeamId: 45, name: "Everton", played: 38, wins: 11, draws: 15, losses: 12, goalsFor: 42, goalsAgainst: 44, form: "WWWDL" },
  { apiTeamId: 48, name: "West Ham", played: 38, wins: 11, draws: 10, losses: 17, goalsFor: 46, goalsAgainst: 62, form: "WLWDL" },
  { apiTeamId: 33, name: "Manchester United", played: 38, wins: 11, draws: 9, losses: 18, goalsFor: 44, goalsAgainst: 54, form: "WLLLD" },
  { apiTeamId: 39, name: "Wolves", played: 38, wins: 12, draws: 6, losses: 20, goalsFor: 54, goalsAgainst: 69, form: "DLLLW" },
  { apiTeamId: 47, name: "Tottenham", played: 38, wins: 11, draws: 5, losses: 22, goalsFor: 64, goalsAgainst: 65, form: "LLLDL" },
  { apiTeamId: 46, name: "Leicester", played: 38, wins: 6, draws: 7, losses: 25, goalsFor: 33, goalsAgainst: 80, form: "LWDWL" },
  { apiTeamId: 57, name: "Ipswich", played: 38, wins: 4, draws: 10, losses: 24, goalsFor: 36, goalsAgainst: 82, form: "LLLDL" },
  { apiTeamId: 41, name: "Southampton", played: 38, wins: 2, draws: 6, losses: 30, goalsFor: 26, goalsAgainst: 86, form: "LLDLL" },
];

/** Seed / short ids used in local demo fixtures. */
const SEED_ID_TO_API: Record<string, number> = {
  liv: 40,
  ars: 42,
  mci: 50,
  che: 49,
  new: 34,
  avl: 66,
  nfo: 65,
  bha: 51,
  bou: 35,
  bre: 55,
  ful: 36,
  cry: 52,
  eve: 45,
  whu: 48,
  mun: 33,
  wol: 39,
  tot: 47,
  lei: 46,
  ips: 57,
  sou: 41,
};

const byApiId = new Map(
  PL_2024_STRENGTH_PRIORS.map((row) => [row.apiTeamId, row]),
);

export function resolveApiTeamId(teamId: string): number | null {
  if (teamId.startsWith("api-team-")) {
    const n = Number(teamId.slice("api-team-".length));
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d+$/.test(teamId)) return Number(teamId);
  return SEED_ID_TO_API[teamId] ?? null;
}

export function getTeamStrengthPrior(
  teamId: string,
): TeamStrengthPrior | null {
  const apiId = resolveApiTeamId(teamId);
  if (apiId == null) return null;
  return byApiId.get(apiId) ?? null;
}

export function priorToTeamStats(teamId: string): TeamStats | null {
  const prior = getTeamStrengthPrior(teamId);
  if (!prior) return null;
  const form = parseForm(prior.form) as FormResult[];
  return {
    teamId,
    season: PRIOR_STRENGTH_SEASON,
    played: prior.played,
    wins: prior.wins,
    draws: prior.draws,
    losses: prior.losses,
    goalsFor: prior.goalsFor,
    goalsAgainst: prior.goalsAgainst,
    form,
    homeForm: form,
    awayForm: form,
  };
}

/**
 * Prefer current-season rows; if thin/missing, fall back to prior season then
 * embedded 2024 strength priors so every club has a distinct profile.
 */
export function resolveTeamStatsForPredict(
  teamId: string,
  rows: Array<{
    team_id: string;
    season: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    form: string | null;
    home_form?: string | null;
    away_form?: string | null;
  }>,
  preferredSeason: number,
): { stats: TeamStats; source: "live" | "prior-season" | "embedded-prior" } {
  const teamRows = rows
    .filter((r) => r.team_id === teamId)
    .sort((a, b) => b.season - a.season);

  const preferred =
    teamRows.find((r) => r.season === preferredSeason) ?? teamRows[0];
  const priorSeason = teamRows.find(
    (r) => r.season === preferredSeason - 1 || r.season === PRIOR_STRENGTH_SEASON,
  );

  const mapRow = (row: (typeof teamRows)[number]): TeamStats => {
    const form = parseForm(row.form);
    return {
      teamId,
      season: row.season,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goals_for,
      goalsAgainst: row.goals_against,
      form,
      homeForm: parseForm(row.home_form).length
        ? parseForm(row.home_form)
        : form,
      awayForm: parseForm(row.away_form).length
        ? parseForm(row.away_form)
        : form,
    };
  };

  const EARLY = 6;
  if (preferred && preferred.played >= EARLY) {
    return { stats: mapRow(preferred), source: "live" };
  }

  if (preferred && preferred.played > 0 && priorSeason) {
    const live = mapRow(preferred);
    const base = mapRow(priorSeason);
    const w = Math.min(1, preferred.played / EARLY);
    const blend = (a: number, b: number) => a * w + b * (1 - w);
    const liveN = Math.max(live.played, 1);
    const baseN = Math.max(base.played, 1);
    const notional = EARLY;
    return {
      stats: {
        teamId,
        season: preferred.season,
        played: notional,
        wins: Math.round(blend(live.wins / liveN, base.wins / baseN) * notional),
        draws: Math.round(blend(live.draws / liveN, base.draws / baseN) * notional),
        losses: Math.round(
          blend(live.losses / liveN, base.losses / baseN) * notional,
        ),
        goalsFor:
          blend(live.goalsFor / liveN, base.goalsFor / baseN) * notional,
        goalsAgainst:
          blend(live.goalsAgainst / liveN, base.goalsAgainst / baseN) *
          notional,
        form: live.form.length ? live.form : base.form,
        homeForm: live.homeForm.length ? live.homeForm : base.homeForm,
        awayForm: live.awayForm.length ? live.awayForm : base.awayForm,
      },
      source: "live",
    };
  }

  if (priorSeason && (!preferred || preferred.played === 0)) {
    return { stats: mapRow(priorSeason), source: "prior-season" };
  }

  if (preferred && preferred.played > 0) {
    return { stats: mapRow(preferred), source: "live" };
  }

  const embedded = priorToTeamStats(teamId);
  if (embedded) {
    return { stats: embedded, source: "embedded-prior" };
  }

  // League-average placeholder (should rarely hit)
  return {
    stats: {
      teamId,
      season: preferredSeason,
      played: 38,
      wins: 12,
      draws: 10,
      losses: 16,
      goalsFor: 50,
      goalsAgainst: 55,
      form: parseForm("DLWDL"),
      homeForm: parseForm("DWLDW"),
      awayForm: parseForm("LDLWD"),
    },
    source: "embedded-prior",
  };
}

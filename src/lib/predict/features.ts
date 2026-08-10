import type { Injury, LineupEntry, MatchDetail, FormResult } from "@/lib/data/types";
import { FIXTURES } from "@/lib/data/seed";
import type { PredictFeatures } from "@/lib/predict/types";

function formPoints(form: FormResult[]): number {
  return form.reduce((sum, result) => {
    if (result === "W") return sum + 3;
    if (result === "D") return sum + 1;
    return sum;
  }, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const POSITION_WEIGHT: Record<string, number> = {
  GK: 1.15,
  DF: 1.0,
  MF: 1.08,
  FW: 1.18,
};

function playerQuality(player: LineupEntry): number {
  const base = player.rating ?? 6.7;
  const contrib = Math.min(0.45, (player.goals * 0.08 + player.assists * 0.06));
  return base + contrib;
}

function weightedXiRating(lineup: LineupEntry[]): number {
  if (!lineup.length) return 6.85;
  let weightSum = 0;
  let scoreSum = 0;
  for (const player of lineup) {
    const w = POSITION_WEIGHT[player.position ?? "MF"] ?? 1;
    weightSum += w;
    scoreSum += playerQuality(player) * w;
  }
  return scoreSum / weightSum;
}

function unitRating(
  lineup: LineupEntry[],
  positions: Array<LineupEntry["position"]>,
): number {
  const group = lineup.filter((p) => positions.includes(p.position));
  return weightedXiRating(group.length ? group : lineup);
}

function restDaysForTeam(teamId: string, kickoffIso: string): number {
  const kickoff = new Date(kickoffIso).getTime();
  const previous = FIXTURES.filter((fixture) => {
    if (fixture.homeTeamId !== teamId && fixture.awayTeamId !== teamId) {
      return false;
    }
    return new Date(fixture.kickoff).getTime() < kickoff;
  }).sort(
    (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
  );

  if (!previous.length) {
    const day = new Date(kickoffIso).getUTCDay();
    return day === 2 || day === 3 ? 3 : 6;
  }

  const gapMs = kickoff - new Date(previous[0].kickoff).getTime();
  const days = gapMs / (1000 * 60 * 60 * 24);
  return clamp(Number(days.toFixed(2)), 2, 14);
}

function injuryPenalties(
  injuries: Injury[],
  teamId: string,
): { attack: number; defence: number; count: number; severity: number } {
  const teamInjuries = injuries.filter((i) => i.isActive && i.teamId === teamId);
  let attack = 0;
  let defence = 0;
  let severity = 0;

  for (const injury of teamInjuries) {
    const type = (injury.injuryType ?? injury.reason ?? "").toLowerCase();
    const severe =
      type.includes("knee") ||
      type.includes("acl") ||
      type.includes("fracture") ||
      type.includes("ligament")
        ? 1.35
        : type.includes("hamstring") || type.includes("muscle")
          ? 1.1
          : 1;

    // Infer role from player id suffix used in seed (gk/df/mf/fw)
    const role = injury.playerId.includes("-gk")
      ? "GK"
      : injury.playerId.includes("-df")
        ? "DF"
        : injury.playerId.includes("-fw")
          ? "FW"
          : "MF";

    if (role === "GK") {
      defence += 0.14 * severe;
    } else if (role === "DF") {
      defence += 0.1 * severe;
      attack += 0.02 * severe;
    } else if (role === "FW") {
      attack += 0.12 * severe;
    } else {
      attack += 0.07 * severe;
      defence += 0.05 * severe;
    }
    severity += severe;
  }

  return {
    attack: clamp(attack, 0, 0.45),
    defence: clamp(defence, 0, 0.45),
    count: teamInjuries.length,
    severity: Number(severity.toFixed(2)),
  };
}

export function buildFeatures(match: MatchDetail): PredictFeatures {
  const home = match.homeStats;
  const away = match.awayStats;

  const homePlayed = Math.max(home?.played ?? 0, 1);
  const awayPlayed = Math.max(away?.played ?? 0, 1);

  const homePpg = home ? (home.wins * 3 + home.draws) / homePlayed : 1.2;
  const awayPpg = away ? (away.wins * 3 + away.draws) / awayPlayed : 1.2;

  const homeGf = home ? home.goalsFor / homePlayed : 1.3;
  const awayGf = away ? away.goalsFor / awayPlayed : 1.3;
  const homeGa = home ? home.goalsAgainst / homePlayed : 1.2;
  const awayGa = away ? away.goalsAgainst / awayPlayed : 1.2;

  const homeXi = weightedXiRating(match.homeLineup);
  const awayXi = weightedXiRating(match.awayLineup);
  const homeAttackXi = unitRating(match.homeLineup, ["FW", "MF"]);
  const awayAttackXi = unitRating(match.awayLineup, ["FW", "MF"]);
  const homeDefenceXi = unitRating(match.homeLineup, ["GK", "DF"]);
  const awayDefenceXi = unitRating(match.awayLineup, ["GK", "DF"]);

  const homeInj = injuryPenalties(match.injuries, match.home.id);
  const awayInj = injuryPenalties(match.injuries, match.away.id);

  const restHome = restDaysForTeam(match.home.id, match.kickoff);
  const restAway = restDaysForTeam(match.away.id, match.kickoff);
  const congestionHome = restHome <= 3.5 ? 1 : restHome <= 5 ? 0.45 : 0;
  const congestionAway = restAway <= 3.5 ? 1 : restAway <= 5 ? 0.45 : 0;

  const h2h = match.headToHead;
  const h2hMatches = h2h.length;
  let h2hHomeWins = 0;
  let h2hHomeGoals = 0;
  let h2hAwayGoals = 0;
  let h2hBtts = 0;
  let h2hOver25 = 0;

  for (const game of h2h) {
    const homeIsCurrentHome = game.homeName === match.home.name;
    const currentHomeGoals = homeIsCurrentHome ? game.homeScore : game.awayScore;
    const currentAwayGoals = homeIsCurrentHome ? game.awayScore : game.homeScore;
    h2hHomeGoals += currentHomeGoals;
    h2hAwayGoals += currentAwayGoals;
    if (currentHomeGoals > currentAwayGoals) h2hHomeWins += 1;
    if (currentHomeGoals > 0 && currentAwayGoals > 0) h2hBtts += 1;
    if (currentHomeGoals + currentAwayGoals > 2.5) h2hOver25 += 1;
  }

  // Style proxies: attacking openness vs defensive block
  const homeStyleAttack = clamp(homeGf / 1.35, 0.7, 1.45);
  const awayStyleAttack = clamp(awayGf / 1.35, 0.7, 1.45);
  const homeStyleBlock = clamp(1.25 / Math.max(homeGa, 0.6), 0.7, 1.4);
  const awayStyleBlock = clamp(1.25 / Math.max(awayGa, 0.6), 0.7, 1.4);
  const setPieceHome = clamp(
    0.85 + (homeAttackXi - 6.8) * 0.12 + homeGf * 0.04,
    0.75,
    1.25,
  );
  const setPieceAway = clamp(
    0.85 + (awayAttackXi - 6.8) * 0.12 + awayGf * 0.04,
    0.75,
    1.25,
  );

  const leagueAvgGoals = 1.32;
  const homeAdv = 0.16;

  const rawHome =
    leagueAvgGoals *
    (homeGf / leagueAvgGoals) *
    (awayGa / leagueAvgGoals) *
    (1 + homeAdv) *
    homeStyleAttack *
    (1 / awayStyleBlock) *
    setPieceHome *
    (1 - homeInj.attack) *
    (1 - congestionHome * 0.06);

  const rawAway =
    leagueAvgGoals *
    (awayGf / leagueAvgGoals) *
    (homeGa / leagueAvgGoals) *
    (1 - homeAdv * 0.3) *
    awayStyleAttack *
    (1 / homeStyleBlock) *
    setPieceAway *
    (1 - awayInj.attack) *
    (1 - congestionAway * 0.06);

  return {
    home_advantage: homeAdv,
    home_ppg: Number(homePpg.toFixed(3)),
    away_ppg: Number(awayPpg.toFixed(3)),
    home_gf_pg: Number(homeGf.toFixed(3)),
    away_gf_pg: Number(awayGf.toFixed(3)),
    home_ga_pg: Number(homeGa.toFixed(3)),
    away_ga_pg: Number(awayGa.toFixed(3)),
    home_gd_pg: Number((homeGf - homeGa).toFixed(3)),
    away_gd_pg: Number((awayGf - awayGa).toFixed(3)),
    home_form_pts: formPoints((home?.form ?? match.home.form).slice(-5)),
    away_form_pts: formPoints((away?.form ?? match.away.form).slice(-5)),
    home_home_form_pts: formPoints((home?.homeForm ?? []).slice(-5)),
    away_away_form_pts: formPoints((away?.awayForm ?? []).slice(-5)),
    home_win_rate: home ? home.wins / homePlayed : 0.35,
    away_win_rate: away ? away.wins / awayPlayed : 0.35,
    home_xi_rating: Number(homeXi.toFixed(3)),
    away_xi_rating: Number(awayXi.toFixed(3)),
    xi_rating_diff: Number((homeXi - awayXi).toFixed(3)),
    home_injury_count: homeInj.count,
    away_injury_count: awayInj.count,
    home_injury_attack_pen: Number(homeInj.attack.toFixed(3)),
    away_injury_attack_pen: Number(awayInj.attack.toFixed(3)),
    home_injury_defence_pen: Number(homeInj.defence.toFixed(3)),
    away_injury_defence_pen: Number(awayInj.defence.toFixed(3)),
    home_attack_xi: Number(homeAttackXi.toFixed(3)),
    away_attack_xi: Number(awayAttackXi.toFixed(3)),
    home_defence_xi: Number(homeDefenceXi.toFixed(3)),
    away_defence_xi: Number(awayDefenceXi.toFixed(3)),
    rest_days_home: restHome,
    rest_days_away: restAway,
    congestion_home: congestionHome,
    congestion_away: congestionAway,
    home_style_attack: Number(homeStyleAttack.toFixed(3)),
    away_style_attack: Number(awayStyleAttack.toFixed(3)),
    home_style_block: Number(homeStyleBlock.toFixed(3)),
    away_style_block: Number(awayStyleBlock.toFixed(3)),
    set_piece_home: Number(setPieceHome.toFixed(3)),
    set_piece_away: Number(setPieceAway.toFixed(3)),
    h2h_home_win_rate: h2hMatches ? h2hHomeWins / h2hMatches : 0.4,
    h2h_avg_home_goals: h2hMatches ? h2hHomeGoals / h2hMatches : homeGf,
    h2h_avg_away_goals: h2hMatches ? h2hAwayGoals / h2hMatches : awayGf,
    h2h_btts_rate: h2hMatches ? h2hBtts / h2hMatches : 0.5,
    h2h_over25_rate: h2hMatches ? h2hOver25 / h2hMatches : 0.5,
    h2h_matches: h2hMatches,
    lineup_confirmed:
      match.lineupStatus === "confirmed"
        ? 1
        : match.lineupStatus === "provisional"
          ? 0.6
          : 0.2,
    home_clean_sheet_proxy: clamp(1 - homeGa / 2.2, 0.05, 0.8),
    away_clean_sheet_proxy: clamp(1 - awayGa / 2.2, 0.05, 0.8),
    goal_expectancy_raw_home: Number(rawHome.toFixed(3)),
    goal_expectancy_raw_away: Number(rawAway.toFixed(3)),
  };
}

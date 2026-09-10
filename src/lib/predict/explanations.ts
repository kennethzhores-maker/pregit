import type { MatchDetail } from "@/lib/data/types";
import type {
  PredictedResult,
  PredictionResult,
} from "@/lib/predict/types";

export function pickPredictedResult(
  homeWinPct: number,
  drawPct: number,
  awayWinPct: number,
): PredictedResult {
  if (homeWinPct >= drawPct && homeWinPct >= awayWinPct) return "home";
  if (awayWinPct >= drawPct && awayWinPct >= homeWinPct) return "away";
  return "draw";
}

export function buildTrustExplanations(
  match: MatchDetail,
  prediction: PredictionResult,
): string[] {
  const f = prediction.features;
  const sim = prediction.simulation;
  const reasons: string[] = [];

  const xgGap = prediction.expectedHomeGoals - prediction.expectedAwayGoals;
  if (Math.abs(xgGap) >= 0.35) {
    const side = xgGap > 0 ? match.home.name : match.away.name;
    reasons.push(
      `${side} hold the xG edge (${prediction.expectedHomeGoals.toFixed(2)}–${prediction.expectedAwayGoals.toFixed(2)}).`,
    );
  } else {
    reasons.push(
      `xG projection is tight (${prediction.expectedHomeGoals.toFixed(2)}–${prediction.expectedAwayGoals.toFixed(2)}).`,
    );
  }

  reasons.push(
    `Home advantage at ${match.venue} (+${(f.home_advantage * 100).toFixed(0)}% chance creation).`,
  );

  if (f.home_form_pts !== f.away_form_pts) {
    const leader =
      f.home_form_pts > f.away_form_pts ? match.home.name : match.away.name;
    reasons.push(
      `${leader} better recent form (${f.home_form_pts} vs ${f.away_form_pts} pts from last 5).`,
    );
  }

  if (f.congestion_home > 0 || f.congestion_away > 0) {
    reasons.push(
      `Congestion factor — home rest ${f.rest_days_home.toFixed(1)}d, away ${f.rest_days_away.toFixed(1)}d.`,
    );
  }

  if (f.home_injury_attack_pen || f.away_injury_attack_pen || f.home_injury_defence_pen || f.away_injury_defence_pen) {
    reasons.push(
      `Injury impact weighted by role — attack pens ${f.home_injury_attack_pen.toFixed(2)}/${f.away_injury_attack_pen.toFixed(2)}.`,
    );
  }

  if (Math.abs(f.xi_rating_diff) >= 0.08) {
    const leader = f.xi_rating_diff > 0 ? match.home.name : match.away.name;
    reasons.push(
      `${leader} edge weighted XI quality (${f.home_xi_rating.toFixed(2)} vs ${f.away_xi_rating.toFixed(2)}).`,
    );
  }

  if (prediction.markets) {
    reasons.push(
      `Calibrated markets — BTTS ${prediction.markets.bttsPct}% (${prediction.markets.bttsLean}) · O2.5 ${prediction.markets.over25Pct}% (${prediction.markets.over25Lean}).`,
    );
  } else {
    reasons.push(
      `Unit matchup ATK ${sim.homeUnits.attack.toFixed(2)} vs DEF ${sim.awayUnits.defence.toFixed(2)}.`,
    );
  }

  if (match.homeStats?.season != null && match.homeStats.season >= 2025) {
    reasons.push(
      `Using live ${match.homeStats.season}/${String(match.homeStats.season + 1).slice(-2)} club rates (GF ${f.home_gf_pg.toFixed(2)} / ${f.away_gf_pg.toFixed(2)} per game).`,
    );
  } else if (match.homeStats?.season === 2024 || match.awayStats?.season === 2024) {
    reasons.push(
      `Club strength uses 2024/25 season rates until live standings sync (set FOOTBALL_DATA_TOKEN).`,
    );
  }

  if (match.lineupStatus !== "confirmed") {
    reasons.push(
      `Lineups are ${match.lineupStatus} — treat confidence as provisional until official XI lock.`,
    );
  } else {
    reasons.push("Official XIs confirmed — confidence is eligible for full weight.");
  }

  return reasons.slice(0, 8);
}

export function applyConfidenceGate(
  rawConfidence: number,
  lineupStatus: MatchDetail["lineupStatus"],
): {
  confidence: number;
  confidenceReliable: boolean;
  confidenceNote: string;
} {
  if (lineupStatus === "confirmed") {
    return {
      confidence: rawConfidence,
      confidenceReliable: true,
      confidenceNote: "Confidence unlocked — confirmed starting XIs.",
    };
  }

  if (lineupStatus === "provisional") {
    const capped = Math.min(rawConfidence, 68);
    return {
      confidence: capped,
      confidenceReliable: false,
      confidenceNote:
        "Provisional XIs only — confidence capped until lineups are confirmed.",
    };
  }

  const capped = Math.min(rawConfidence, 55);
  return {
    confidence: capped,
    confidenceReliable: false,
    confidenceNote:
      "No published XI — confidence is informational only, not a trust signal.",
  };
}

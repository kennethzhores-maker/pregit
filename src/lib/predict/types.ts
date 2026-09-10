export type PredictedResult = "home" | "draw" | "away";

export type MarketEvaluation = {
  market: "result" | "btts" | "over25" | "exact_score";
  predicted: string;
  actual: string;
  correct: boolean;
};

export type PredictionRecord = {
  id: string;
  fixtureId: string;
  homeName: string;
  awayName: string;
  kickoff: string;
  createdAt: string;
  modelVersion: string;
  predictedResult: PredictedResult;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  mostLikelyScore: string;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  bttsPct: number;
  over25Pct: number;
  confidence: number;
  confidenceReliable: boolean;
  confidenceNote: string;
  lineupStatus: string;
  reasons: string[];
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  evaluatedAt: string | null;
  markets: MarketEvaluation[];
  resultCorrect: boolean | null;
};

export type AccuracySummary = {
  sampleSize: number;
  evaluatedCount: number;
  pendingCount: number;
  resultAccuracyPct: number | null;
  bttsAccuracyPct: number | null;
  over25AccuracyPct: number | null;
  exactScoreAccuracyPct: number | null;
  avgConfidence: number | null;
  reliableSampleSize: number;
  reliableResultAccuracyPct: number | null;
  statement: string;
};

export type PredictionResult = {
  fixtureId: string;
  modelVersion: string;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  mostLikelyScore: string;
  topScorelines: ScorelineProbability[];
  confidence: number;
  confidenceReliable: boolean;
  confidenceNote: string;
  reasons: string[];
  features: PredictFeatures;
  source: "local" | "ai-engine";
  poisson: MethodBreakdown;
  simulation: SimulationBreakdown;
  ensembleWeights: {
    poisson: number;
    simulation: number;
  };
  markets: {
    bttsPct: number;
    over25Pct: number;
    under25Pct: number;
    bttsLean: "yes" | "no";
    over25Lean: "over" | "under";
  };
  plan?: "free" | "pro";
  entitlements?: {
    fullSimulation: boolean;
    timeline: boolean;
    fullExplanations: boolean;
    unlimitedPredicts: boolean;
  };
  timeline?: Array<{
    minute: number;
    type: "kickoff" | "chance" | "goal" | "ht" | "ft" | "note";
    side: "home" | "away" | "none";
    text: string;
  }>;
  usage?: {
    limit: number;
    remaining: number;
    count: number;
    plan?: "free" | "pro";
    unlimited?: boolean;
  };
  refresh?: {
    refreshedAt: string;
    source: string;
    lineupStatus: string;
    homeXiCount: number;
    awayXiCount: number;
    injuryCount: number;
    hoursToKickoff: number | null;
    notes: string[];
    changed: boolean;
    snapshotHash: string;
  };
};

export type PredictFeatures = {
  home_advantage: number;
  home_ppg: number;
  away_ppg: number;
  home_gf_pg: number;
  away_gf_pg: number;
  home_ga_pg: number;
  away_ga_pg: number;
  home_gd_pg: number;
  away_gd_pg: number;
  home_form_pts: number;
  away_form_pts: number;
  home_home_form_pts: number;
  away_away_form_pts: number;
  home_win_rate: number;
  away_win_rate: number;
  home_xi_rating: number;
  away_xi_rating: number;
  xi_rating_diff: number;
  home_injury_count: number;
  away_injury_count: number;
  home_injury_attack_pen: number;
  away_injury_attack_pen: number;
  home_injury_defence_pen: number;
  away_injury_defence_pen: number;
  home_attack_xi: number;
  away_attack_xi: number;
  home_defence_xi: number;
  away_defence_xi: number;
  rest_days_home: number;
  rest_days_away: number;
  congestion_home: number;
  congestion_away: number;
  home_style_attack: number;
  away_style_attack: number;
  home_style_block: number;
  away_style_block: number;
  set_piece_home: number;
  set_piece_away: number;
  h2h_home_win_rate: number;
  h2h_avg_home_goals: number;
  h2h_avg_away_goals: number;
  h2h_btts_rate: number;
  h2h_over25_rate: number;
  h2h_matches: number;
  lineup_confirmed: number;
  home_clean_sheet_proxy: number;
  away_clean_sheet_proxy: number;
  goal_expectancy_raw_home: number;
  goal_expectancy_raw_away: number;
};

export type ScorelineProbability = {
  homeGoals: number;
  awayGoals: number;
  probability: number;
};

export type MethodBreakdown = {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  mostLikelyScore: string;
  topScorelines: ScorelineProbability[];
};

export type SimulationBreakdown = MethodBreakdown & {
  iterations: number;
  bttsPct: number;
  over25Pct: number;
  homeUnits: {
    attack: number;
    midfield: number;
    defence: number;
    gk: number;
    stamina: number;
  };
  awayUnits: {
    attack: number;
    midfield: number;
    defence: number;
    gk: number;
    stamina: number;
  };
};

export const MODEL_VERSION = "ensemble-sim-v3";
/** Base Monte Carlo runs; confirmed near-kickoff predicts use the boost. */
export const DEFAULT_SIM_ITERATIONS = Number(
  process.env.PREDICT_SIM_ITERATIONS ?? 4000,
);
export const CONFIRMED_SIM_ITERATIONS = Number(
  process.env.PREDICT_SIM_ITERATIONS_CONFIRMED ?? 8000,
);
export const FREE_SIM_ITERATIONS = Number(
  process.env.PREDICT_SIM_ITERATIONS_FREE ?? 2500,
);
export const SIM_WEIGHT = 0.52;
export const POISSON_WEIGHT = 0.48;

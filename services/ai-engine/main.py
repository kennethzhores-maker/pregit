"""Pregit AI engine — ensemble-sim-v1 (poisson + Monte Carlo XI sim)."""

from __future__ import annotations

from collections import Counter
from math import exp, factorial
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_VERSION = "ensemble-sim-v1"
POISSON_WEIGHT = 0.45
SIM_WEIGHT = 0.55
DEFAULT_ITERATIONS = 10000

app = FastAPI(title="Pregit AI Engine", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    fixture_id: str
    features: dict[str, float]
    iterations: int = Field(default=DEFAULT_ITERATIONS, ge=1000, le=50000)


class Scoreline(BaseModel):
    homeGoals: int
    awayGoals: int
    probability: float


class MethodBreakdown(BaseModel):
    homeWinPct: float
    drawPct: float
    awayWinPct: float
    expectedHomeGoals: float
    expectedAwayGoals: float
    mostLikelyScore: str
    topScorelines: list[Scoreline]


class SideUnits(BaseModel):
    attack: float
    midfield: float
    defence: float
    gk: float
    stamina: float


class SimulationBreakdown(MethodBreakdown):
    iterations: int
    bttsPct: float
    over25Pct: float
    homeUnits: SideUnits
    awayUnits: SideUnits


class PredictResponse(BaseModel):
    fixtureId: str
    modelVersion: str
    homeWinPct: float
    drawPct: float
    awayWinPct: float
    expectedHomeGoals: float
    expectedAwayGoals: float
    mostLikelyScore: str
    topScorelines: list[Scoreline]
    confidence: float
    reasons: list[str]
    features: dict[str, float]
    source: str = "ai-engine"
    poisson: MethodBreakdown
    simulation: SimulationBreakdown
    ensembleWeights: dict[str, float]


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def poisson_pmf(k: int, lam: float) -> float:
    return exp(-lam) * (lam**k) / factorial(k)


def expected_goals(features: dict[str, float]) -> tuple[float, float]:
    home = float(features.get("goal_expectancy_raw_home", 1.35))
    away = float(features.get("goal_expectancy_raw_away", 1.15))

    home *= 1 + (features.get("home_form_pts", 7.5) - 7.5) * 0.018
    away *= 1 + (features.get("away_form_pts", 7.5) - 7.5) * 0.018
    home *= 1 + (features.get("home_home_form_pts", 7.5) - 7.5) * 0.012
    away *= 1 + (features.get("away_away_form_pts", 7.5) - 7.5) * 0.012

    xi_diff = features.get("xi_rating_diff", 0.0)
    home *= 1 + xi_diff * 0.04
    away *= 1 - xi_diff * 0.035

    home *= 1 + (features.get("home_attack_xi", 6.9) - 6.9) * 0.03
    away *= 1 + (features.get("away_attack_xi", 6.9) - 6.9) * 0.03
    home *= 1 - (features.get("away_defence_xi", 6.9) - 6.9) * 0.025
    away *= 1 - (features.get("home_defence_xi", 6.9) - 6.9) * 0.025

    home *= 1 - features.get("home_injury_count", 0.0) * 0.04
    away *= 1 - features.get("away_injury_count", 0.0) * 0.04

    home *= 1 + (features.get("rest_days_home", 5.0) - 5) * 0.015
    away *= 1 + (features.get("rest_days_away", 5.0) - 5) * 0.015

    h2h_matches = features.get("h2h_matches", 0.0)
    if h2h_matches > 0:
        w = min(0.25, 0.08 * h2h_matches)
        home = home * (1 - w) + features.get("h2h_avg_home_goals", home) * w
        away = away * (1 - w) + features.get("h2h_avg_away_goals", away) * w

    ppg_diff = features.get("home_ppg", 1.2) - features.get("away_ppg", 1.2)
    home *= 1 + ppg_diff * 0.04
    away *= 1 - ppg_diff * 0.035

    return clamp(home, 0.35, 4.2), clamp(away, 0.35, 4.2)


def score_matrix(lam_h: float, lam_a: float, max_goals: int = 6) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for hg in range(max_goals + 1):
        for ag in range(max_goals + 1):
            lines.append(
                {
                    "homeGoals": hg,
                    "awayGoals": ag,
                    "probability": poisson_pmf(hg, lam_h) * poisson_pmf(ag, lam_a),
                }
            )
    total = sum(line["probability"] for line in lines) or 1.0
    for line in lines:
        line["probability"] /= total
    lines.sort(key=lambda item: item["probability"], reverse=True)
    return lines


def aggregate(lines: list[dict[str, Any]]) -> tuple[float, float, float]:
    home = draw = away = 0.0
    for line in lines:
        if line["homeGoals"] > line["awayGoals"]:
            home += line["probability"]
        elif line["homeGoals"] == line["awayGoals"]:
            draw += line["probability"]
        else:
            away += line["probability"]
    total = home + draw + away or 1.0
    return home / total * 100, draw / total * 100, away / total * 100


def normalize_rating(rating: float) -> float:
    return clamp(0.7 + (rating - 6.4) * 0.2, 0.7, 1.25)


def side_units(features: dict[str, float], side: str) -> dict[str, float]:
    if side == "home":
        attack = features.get("home_attack_xi", 6.9)
        mid = features.get("home_xi_rating", 6.9)
        defence = features.get("home_defence_xi", 6.9)
        form_pts = features.get("home_form_pts", 7.5)
        rest = features.get("rest_days_home", 5.0)
        injuries = features.get("home_injury_count", 0.0)
    else:
        attack = features.get("away_attack_xi", 6.9)
        mid = features.get("away_xi_rating", 6.9)
        defence = features.get("away_defence_xi", 6.9)
        form_pts = features.get("away_form_pts", 7.5)
        rest = features.get("rest_days_away", 5.0)
        injuries = features.get("away_injury_count", 0.0)

    form_mul = 1 + (form_pts - 7.5) * 0.02
    stamina = clamp(0.92 + (rest - 4) * 0.025 - injuries * 0.03, 0.88, 1.08)
    return {
        "attack": normalize_rating(attack) * form_mul,
        "midfield": normalize_rating(mid) * form_mul,
        "defence": normalize_rating(defence) * (1 - injuries * 0.02),
        "gk": normalize_rating(defence),
        "stamina": stamina,
    }


class Mulberry32:
    def __init__(self, seed: int) -> None:
        self.t = seed & 0xFFFFFFFF

    def __call__(self) -> float:
        self.t = (self.t + 0x6D2B79F5) & 0xFFFFFFFF
        r = self.t
        r = ((r ^ (r >> 15)) * (1 | r)) & 0xFFFFFFFF
        r ^= (r + (((r ^ (r >> 7)) * (61 | r)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((r ^ (r >> 14)) & 0xFFFFFFFF) / 4294967296.0


def hash_seed(text: str) -> int:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def simulate_one(
    home: dict[str, float],
    away: dict[str, float],
    home_adv: float,
    rng: Mulberry32,
) -> tuple[int, int]:
    home_goals = away_goals = 0
    for minute in range(1, 91):
        late = 0.94 if minute >= 75 else 0.98 if minute >= 60 else 1.0
        home_fatigue = home["stamina"] * late
        away_fatigue = away["stamina"] * late

        home_chance = (
            0.038
            * ((home["attack"] * 0.65 + home["midfield"] * 0.35)
               / max(0.55, away["defence"] * 0.7 + away["midfield"] * 0.3))
            * (1 + home_adv)
            * home_fatigue
        )
        away_chance = (
            0.034
            * ((away["attack"] * 0.65 + away["midfield"] * 0.35)
               / max(0.55, home["defence"] * 0.7 + home["midfield"] * 0.3))
            * away_fatigue
        )

        if rng() < home_chance:
            convert = 0.26 * (
                home["attack"] / max(0.6, away["gk"] * 0.55 + away["defence"] * 0.45)
            )
            if rng() < min(0.55, convert):
                home_goals += 1

        if rng() < away_chance:
            convert = 0.24 * (
                away["attack"] / max(0.6, home["gk"] * 0.55 + home["defence"] * 0.45)
            )
            if rng() < min(0.52, convert):
                away_goals += 1

    return home_goals, away_goals


def run_simulation(features: dict[str, float], fixture_id: str, iterations: int) -> dict[str, Any]:
    home = side_units(features, "home")
    away = side_units(features, "away")
    rng = Mulberry32(hash_seed(f"{fixture_id}:{iterations}:sim-v1"))
    home_adv = features.get("home_advantage", 0.18)

    score_counts: Counter[str] = Counter()
    home_wins = draws = away_wins = 0
    home_goals_total = away_goals_total = 0
    btts = over25 = 0

    for _ in range(iterations):
        hg, ag = simulate_one(home, away, home_adv, rng)
        home_goals_total += hg
        away_goals_total += ag
        if hg > ag:
            home_wins += 1
        elif hg == ag:
            draws += 1
        else:
            away_wins += 1
        if hg > 0 and ag > 0:
            btts += 1
        if hg + ag > 2.5:
            over25 += 1
        score_counts[f"{min(hg, 8)}-{min(ag, 8)}"] += 1

    top = [
        {
            "homeGoals": int(score.split("-")[0]),
            "awayGoals": int(score.split("-")[1]),
            "probability": round(count / iterations * 100, 2),
        }
        for score, count in score_counts.most_common(5)
    ]
    most = top[0]

    return {
        "iterations": iterations,
        "homeWinPct": round(home_wins / iterations * 100, 1),
        "drawPct": round(draws / iterations * 100, 1),
        "awayWinPct": round(away_wins / iterations * 100, 1),
        "expectedHomeGoals": round(home_goals_total / iterations, 2),
        "expectedAwayGoals": round(away_goals_total / iterations, 2),
        "mostLikelyScore": f"{most['homeGoals']}-{most['awayGoals']}",
        "topScorelines": top,
        "bttsPct": round(btts / iterations * 100, 1),
        "over25Pct": round(over25 / iterations * 100, 1),
        "homeUnits": {k: round(v, 3) for k, v in home.items()},
        "awayUnits": {k: round(v, 3) for k, v in away.items()},
    }


def blend(model: dict[str, float], sim: dict[str, float]) -> dict[str, float]:
    home = model["homeWinPct"] * POISSON_WEIGHT + sim["homeWinPct"] * SIM_WEIGHT
    draw = model["drawPct"] * POISSON_WEIGHT + sim["drawPct"] * SIM_WEIGHT
    away = model["awayWinPct"] * POISSON_WEIGHT + sim["awayWinPct"] * SIM_WEIGHT
    total = home + draw + away or 1.0
    return {
        "homeWinPct": round(home / total * 100, 1),
        "drawPct": round(draw / total * 100, 1),
        "awayWinPct": round(away / total * 100, 1),
    }


def merge_scorelines(poisson_top: list[dict[str, Any]], sim_top: list[dict[str, Any]]) -> list[Scoreline]:
    merged: dict[str, float] = {}
    for line in poisson_top:
        key = f"{line['homeGoals']}-{line['awayGoals']}"
        merged[key] = merged.get(key, 0.0) + line["probability"] * POISSON_WEIGHT
    for line in sim_top:
        key = f"{line['homeGoals']}-{line['awayGoals']}"
        merged[key] = merged.get(key, 0.0) + line["probability"] * SIM_WEIGHT
    ranked = sorted(merged.items(), key=lambda item: item[1], reverse=True)[:5]
    out: list[Scoreline] = []
    for score, prob in ranked:
        hg, ag = score.split("-")
        out.append(Scoreline(homeGoals=int(hg), awayGoals=int(ag), probability=round(prob, 2)))
    return out


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_VERSION}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    features = payload.features
    lam_h, lam_a = expected_goals(features)
    lines = score_matrix(lam_h, lam_a)
    home_pct, draw_pct, away_pct = aggregate(lines)
    poisson_top = [
        {
            "homeGoals": line["homeGoals"],
            "awayGoals": line["awayGoals"],
            "probability": round(line["probability"] * 100, 2),
        }
        for line in lines[:5]
    ]
    best = lines[0]
    poisson = {
        "homeWinPct": round(home_pct, 1),
        "drawPct": round(draw_pct, 1),
        "awayWinPct": round(away_pct, 1),
        "expectedHomeGoals": round(lam_h, 2),
        "expectedAwayGoals": round(lam_a, 2),
        "mostLikelyScore": f"{best['homeGoals']}-{best['awayGoals']}",
        "topScorelines": poisson_top,
    }

    sim = run_simulation(features, payload.fixture_id, payload.iterations)
    blended = blend(poisson, sim)
    top = merge_scorelines(poisson_top, sim["topScorelines"])
    most_likely = f"{top[0].homeGoals}-{top[0].awayGoals}"

    expected_home = round(
        poisson["expectedHomeGoals"] * POISSON_WEIGHT
        + sim["expectedHomeGoals"] * SIM_WEIGHT,
        2,
    )
    expected_away = round(
        poisson["expectedAwayGoals"] * POISSON_WEIGHT
        + sim["expectedAwayGoals"] * SIM_WEIGHT,
        2,
    )

    method_gap = abs(poisson["homeWinPct"] - sim["homeWinPct"])
    conf = 58
    conf += features.get("lineup_confirmed", 0.2) * 18
    conf += min(10.0, abs(blended["homeWinPct"] - blended["awayWinPct"]) * 0.35)
    conf -= min(12.0, method_gap * 0.25)
    conf += min(8.0, features.get("h2h_matches", 0.0) * 2)
    conf -= (
        features.get("home_injury_count", 0.0) + features.get("away_injury_count", 0.0)
    ) * 2.5
    conf = round(clamp(conf, 45, 93))

    reasons = [
        f"Ensemble {int(SIM_WEIGHT * 100)}% minute-sim / {int(POISSON_WEIGHT * 100)}% poisson ({sim['iterations']:,} runs).",
        (
            f"Unit matchup — home ATK {sim['homeUnits']['attack']:.2f} "
            f"vs away DEF {sim['awayUnits']['defence']:.2f}."
        ),
        f"Sim markets: BTTS {sim['bttsPct']}% · O2.5 {sim['over25Pct']}% · score mode {sim['mostLikelyScore']}.",
    ]

    return PredictResponse(
        fixtureId=payload.fixture_id,
        modelVersion=MODEL_VERSION,
        homeWinPct=blended["homeWinPct"],
        drawPct=blended["drawPct"],
        awayWinPct=blended["awayWinPct"],
        expectedHomeGoals=expected_home,
        expectedAwayGoals=expected_away,
        mostLikelyScore=most_likely,
        topScorelines=top,
        confidence=conf,
        reasons=reasons,
        features=features,
        source="ai-engine",
        poisson=MethodBreakdown(
            homeWinPct=poisson["homeWinPct"],
            drawPct=poisson["drawPct"],
            awayWinPct=poisson["awayWinPct"],
            expectedHomeGoals=poisson["expectedHomeGoals"],
            expectedAwayGoals=poisson["expectedAwayGoals"],
            mostLikelyScore=poisson["mostLikelyScore"],
            topScorelines=[Scoreline(**line) for line in poisson_top],
        ),
        simulation=SimulationBreakdown(
            homeWinPct=sim["homeWinPct"],
            drawPct=sim["drawPct"],
            awayWinPct=sim["awayWinPct"],
            expectedHomeGoals=sim["expectedHomeGoals"],
            expectedAwayGoals=sim["expectedAwayGoals"],
            mostLikelyScore=sim["mostLikelyScore"],
            topScorelines=[Scoreline(**line) for line in sim["topScorelines"]],
            iterations=sim["iterations"],
            bttsPct=sim["bttsPct"],
            over25Pct=sim["over25Pct"],
            homeUnits=SideUnits(**sim["homeUnits"]),
            awayUnits=SideUnits(**sim["awayUnits"]),
        ),
        ensembleWeights={"poisson": POISSON_WEIGHT, "simulation": SIM_WEIGHT},
    )

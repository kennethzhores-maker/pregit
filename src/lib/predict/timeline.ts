import type { MatchDetail } from "@/lib/data/types";
import type { PredictionResult } from "@/lib/predict/types";

export type TimelineEvent = {
  minute: number;
  type: "kickoff" | "chance" | "goal" | "ht" | "ft" | "note";
  side: "home" | "away" | "none";
  text: string;
};

/**
 * Lightweight text timeline derived from the predicted scoreline + unit strengths.
 * Not a full animation — a readable narrative of one plausible path.
 */
export function buildMatchTimeline(
  match: MatchDetail,
  prediction: PredictionResult,
): TimelineEvent[] {
  const [homeGoals, awayGoals] = prediction.mostLikelyScore.split("-").map(Number);
  const events: TimelineEvent[] = [
    {
      minute: 1,
      type: "kickoff",
      side: "none",
      text: `Kickoff at ${match.venue}. ${match.home.name} vs ${match.away.name}.`,
    },
  ];

  const homeAttack = prediction.simulation.homeUnits.attack;
  const awayAttack = prediction.simulation.awayUnits.attack;
  const totalAttack = homeAttack + awayAttack || 1;

  const scheduleGoals = (count: number, side: "home" | "away") => {
    const minutes: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const base =
        side === "home"
          ? 12 + i * Math.floor(70 / Math.max(count, 1)) + Math.round(homeAttack * 7)
          : 18 + i * Math.floor(65 / Math.max(count, 1)) + Math.round(awayAttack * 6);
      minutes.push(Math.min(88, Math.max(6, base + (i % 2) * 5)));
    }
    return minutes;
  };

  const homeGoalMinutes = scheduleGoals(homeGoals || 0, "home");
  const awayGoalMinutes = scheduleGoals(awayGoals || 0, "away");

  // Early chance for the stronger attack
  if (homeAttack >= awayAttack) {
    events.push({
      minute: 9,
      type: "chance",
      side: "home",
      text: `${match.home.name} work an early opening through midfield.`,
    });
  } else {
    events.push({
      minute: 11,
      type: "chance",
      side: "away",
      text: `${match.away.name} break on the counter and force a save.`,
    });
  }

  const goalEvents = [
    ...homeGoalMinutes.map((minute) => ({
      minute,
      type: "goal" as const,
      side: "home" as const,
      text: `Goal — ${match.home.name}.`,
    })),
    ...awayGoalMinutes.map((minute) => ({
      minute,
      type: "goal" as const,
      side: "away" as const,
      text: `Goal — ${match.away.name}.`,
    })),
  ].sort((a, b) => a.minute - b.minute);

  let runningHome = 0;
  let runningAway = 0;
  let htInserted = false;

  for (const goal of goalEvents) {
    if (!htInserted && goal.minute > 45) {
      events.push({
        minute: 45,
        type: "ht",
        side: "none",
        text: `Half-time ${runningHome}-${runningAway}.`,
      });
      htInserted = true;
    }

    if (goal.side === "home") runningHome += 1;
    else runningAway += 1;

    events.push({
      ...goal,
      text: `${goal.text} ${runningHome}-${runningAway}.`,
    });
  }

  if (!htInserted) {
    events.push({
      minute: 45,
      type: "ht",
      side: "none",
      text: `Half-time ${runningHome}-${runningAway}.`,
    });
  }

  if (prediction.markets.bttsLean === "yes" && (homeGoals === 0 || awayGoals === 0)) {
    events.push({
      minute: 62,
      type: "chance",
      side: homeGoals === 0 ? "home" : "away",
      text: "Late pressure for a reply — chance flashed wide.",
    });
  } else if (homeAttack / totalAttack > 0.58) {
    events.push({
      minute: 71,
      type: "note",
      side: "home",
      text: `${match.home.name} control territory; away side defend deep.`,
    });
  } else {
    events.push({
      minute: 74,
      type: "note",
      side: "away",
      text: `${match.away.name} stay dangerous in transition.`,
    });
  }

  events.push({
    minute: 90,
    type: "ft",
    side: "none",
    text: `Full-time ${prediction.mostLikelyScore} (narrative path · not live sim).`,
  });

  return events.sort((a, b) => a.minute - b.minute);
}

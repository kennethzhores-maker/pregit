import type {
  FormResult,
  Injury,
  LineupEntry,
  MatchDetail,
  TeamStats,
} from "@/lib/data/types";

export type StatComparison = {
  label: string;
  home: number;
  away: number;
  higherIsBetter?: boolean;
  format?: "number" | "decimal";
};

export type Insight = {
  tone: "positive" | "neutral" | "warning";
  text: string;
};

function ppg(stats: TeamStats): number {
  if (!stats.played) return 0;
  return (stats.wins * 3 + stats.draws) / stats.played;
}

function formPoints(form: FormResult[]): number {
  return form.reduce((sum, result) => {
    if (result === "W") return sum + 3;
    if (result === "D") return sum + 1;
    return sum;
  }, 0);
}

export function buildStatComparisons(
  home: TeamStats | null,
  away: TeamStats | null,
): StatComparison[] {
  if (!home || !away) return [];

  return [
    {
      label: "Points per game",
      home: Number(ppg(home).toFixed(2)),
      away: Number(ppg(away).toFixed(2)),
      format: "decimal",
    },
    {
      label: "Goals scored / game",
      home: Number((home.goalsFor / Math.max(home.played, 1)).toFixed(2)),
      away: Number((away.goalsFor / Math.max(away.played, 1)).toFixed(2)),
      format: "decimal",
    },
    {
      label: "Goals conceded / game",
      home: Number((home.goalsAgainst / Math.max(home.played, 1)).toFixed(2)),
      away: Number((away.goalsAgainst / Math.max(away.played, 1)).toFixed(2)),
      higherIsBetter: false,
      format: "decimal",
    },
    {
      label: "Goal difference",
      home: home.goalsFor - home.goalsAgainst,
      away: away.goalsFor - away.goalsAgainst,
    },
    {
      label: "Last 5 pts",
      home: formPoints(home.form.slice(-5)),
      away: formPoints(away.form.slice(-5)),
    },
  ];
}

export function averageLineupRating(lineup: LineupEntry[]): number | null {
  const rated = lineup.filter((p) => p.rating != null);
  if (!rated.length) return null;
  const sum = rated.reduce((acc, p) => acc + (p.rating ?? 0), 0);
  return Number((sum / rated.length).toFixed(2));
}

export function topLineupPlayers(lineup: LineupEntry[], limit = 3): LineupEntry[] {
  return [...lineup]
    .sort((a, b) => {
      const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return b.goals + b.assists - (a.goals + a.assists);
    })
    .slice(0, limit);
}

export function buildMatchInsights(match: MatchDetail): Insight[] {
  const insights: Insight[] = [];
  const home = match.homeStats;
  const away = match.awayStats;

  if (home && away) {
    const homePpg = ppg(home);
    const awayPpg = ppg(away);
    if (Math.abs(homePpg - awayPpg) >= 0.4) {
      const leader = homePpg > awayPpg ? match.home.name : match.away.name;
      insights.push({
        tone: "positive",
        text: `${leader} hold the stronger season form (${Math.max(homePpg, awayPpg).toFixed(2)} vs ${Math.min(homePpg, awayPpg).toFixed(2)} PPG).`,
      });
    }

    const homeAttack = home.goalsFor / Math.max(home.played, 1);
    const awayAttack = away.goalsFor / Math.max(away.played, 1);
    if (homeAttack - awayAttack >= 0.4) {
      insights.push({
        tone: "positive",
        text: `${match.home.name} are creating more goals at home-side tempo (${homeAttack.toFixed(1)} GF/game).`,
      });
    } else if (awayAttack - homeAttack >= 0.4) {
      insights.push({
        tone: "positive",
        text: `${match.away.name} arrive with the sharper attack (${awayAttack.toFixed(1)} GF/game).`,
      });
    }
  }

  if (match.homeStats?.homeForm?.length) {
    const pts = formPoints(match.homeStats.homeForm.slice(-5));
    if (pts >= 10) {
      insights.push({
        tone: "positive",
        text: `${match.home.name} are strong at home recently (${pts}/15 pts from last home run).`,
      });
    }
  }

  if (match.awayStats?.awayForm?.length) {
    const pts = formPoints(match.awayStats.awayForm.slice(-5));
    if (pts <= 4) {
      insights.push({
        tone: "warning",
        text: `${match.away.name} have struggled away (${pts}/15 pts on the road).`,
      });
    }
  }

  const homeInjuries = match.injuries.filter((i) => i.teamId === match.home.id);
  const awayInjuries = match.injuries.filter((i) => i.teamId === match.away.id);
  if (homeInjuries.length || awayInjuries.length) {
    const parts: string[] = [];
    if (homeInjuries.length) {
      parts.push(`${match.home.name}: ${homeInjuries.map((i) => i.playerName).join(", ")}`);
    }
    if (awayInjuries.length) {
      parts.push(`${match.away.name}: ${awayInjuries.map((i) => i.playerName).join(", ")}`);
    }
    insights.push({
      tone: "warning",
      text: `Key absences — ${parts.join(" · ")}.`,
    });
  }

  if (match.lineupStatus === "confirmed") {
    insights.push({
      tone: "neutral",
      text: "Official starting XIs are locked in for this fixture.",
    });
  } else if (match.lineupStatus === "provisional") {
    insights.push({
      tone: "neutral",
      text: "Lineups are provisional — expect late changes before kickoff.",
    });
  } else {
    insights.push({
      tone: "neutral",
      text: "Starting XIs not published yet. Form and absences are the best read for now.",
    });
  }

  const homeRating = averageLineupRating(match.homeLineup);
  const awayRating = averageLineupRating(match.awayLineup);
  if (homeRating && awayRating && Math.abs(homeRating - awayRating) >= 0.15) {
    const leader =
      homeRating > awayRating ? match.home.name : match.away.name;
    insights.push({
      tone: "positive",
      text: `${leader} edge the XI quality rating (${Math.max(homeRating, awayRating).toFixed(2)} vs ${Math.min(homeRating, awayRating).toFixed(2)}).`,
    });
  }

  return insights.slice(0, 5);
}

export function groupInjuriesByTeam(
  match: MatchDetail,
): { home: Injury[]; away: Injury[] } {
  return {
    home: match.injuries.filter((injury) => injury.teamId === match.home.id),
    away: match.injuries.filter((injury) => injury.teamId === match.away.id),
  };
}

export function kickoffLabel(iso: string, status: MatchDetail["status"]): string {
  if (status === "live") return "Live now";
  if (status === "finished") return "Full time";

  const kickoff = new Date(iso).getTime();
  const diffMs = kickoff - Date.now();
  const absHours = Math.abs(diffMs) / (1000 * 60 * 60);

  if (diffMs < 0 && absHours < 3) return "Kickoff passed";
  if (diffMs < 0) return "Completed window";

  if (diffMs < 1000 * 60 * 60) {
    const mins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    return `Kickoff in ${mins}m`;
  }

  if (diffMs < 1000 * 60 * 60 * 48) {
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    return `Kickoff in ${hours}h`;
  }

  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return `Kickoff in ${days}d`;
}

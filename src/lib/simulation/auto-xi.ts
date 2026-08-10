import type { SimPlayer } from "@/lib/simulation/types";

/** Best available 1-4-3-3 XI by rating. */
export function autoPickXi(players: SimPlayer[]): string[] {
  const byPos = {
    GK: players
      .filter((p) => p.position === "GK")
      .sort((a, b) => b.rating - a.rating),
    DF: players
      .filter((p) => p.position === "DF")
      .sort((a, b) => b.rating - a.rating),
    MF: players
      .filter((p) => p.position === "MF")
      .sort((a, b) => b.rating - a.rating),
    FW: players
      .filter((p) => p.position === "FW")
      .sort((a, b) => b.rating - a.rating),
  };

  const picks = [
    ...byPos.GK.slice(0, 1),
    ...byPos.DF.slice(0, 4),
    ...byPos.MF.slice(0, 3),
    ...byPos.FW.slice(0, 3),
  ];

  if (picks.length < 11) {
    const chosen = new Set(picks.map((p) => p.id));
    const rest = [...players]
      .filter((p) => !chosen.has(p.id))
      .sort((a, b) => b.rating - a.rating);
    for (const player of rest) {
      if (picks.length >= 11) break;
      picks.push(player);
    }
  }

  return picks.slice(0, 11).map((p) => p.id);
}

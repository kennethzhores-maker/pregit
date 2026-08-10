import type { HeadToHeadResult, LineupEntry, LineupStatus } from "@/lib/data/types";
import { formatKickoff } from "@/lib/data/types";
import { FormBadges } from "@/components/form-badges";
import type { FormResult } from "@/lib/data/types";
import {
  averageLineupRating,
  topLineupPlayers,
} from "@/lib/data/intelligence";

const positionOrder = ["GK", "DF", "MF", "FW"] as const;

export function LineupBoard({
  title,
  players,
  lineupStatus,
}: {
  title: string;
  players: LineupEntry[];
  lineupStatus: LineupStatus;
}) {
  const rating = averageLineupRating(players);
  const standouts = topLineupPlayers(players, 2);

  return (
    <div className="rounded-lg border border-[var(--line)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {title}
          </h2>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
            {lineupStatus === "confirmed"
              ? "Confirmed"
              : lineupStatus === "provisional"
                ? "Provisional"
                : "Awaiting lineup"}
          </p>
        </div>
        {rating ? (
          <div className="text-right">
            <div className="font-[family-name:var(--font-display)] text-2xl text-[var(--pitch)]">
              {rating.toFixed(2)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              XI rating
            </div>
          </div>
        ) : null}
      </div>

      {players.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Starting XI not published yet. Check back closer to kickoff.
        </p>
      ) : (
        <>
          {standouts.length ? (
            <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--panel-hover)] px-3 py-2 text-xs text-[var(--muted)]">
              Watch:{" "}
              {standouts
                .map((p) => `${p.playerName}${p.rating ? ` (${p.rating.toFixed(1)})` : ""}`)
                .join(" · ")}
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {positionOrder.map((position) => {
              const group = players.filter((p) => p.position === position);
              if (!group.length) return null;
              return (
                <div key={position}>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {position}
                  </div>
                  <ul className="space-y-1.5">
                    {group.map((player) => (
                      <li
                        key={player.playerId}
                        className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-2 text-sm"
                      >
                        <span className="font-mono text-[var(--muted)]">
                          {player.shirtNumber ?? "–"}
                        </span>
                        <span>{player.playerName}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {player.rating ? player.rating.toFixed(1) : ""}
                          {player.goals || player.assists
                            ? ` · ${player.goals}G ${player.assists}A`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function SideFormPanel({
  homeName,
  awayName,
  homeForm,
  awayForm,
  homeHomeForm,
  awayAwayForm,
}: {
  homeName: string;
  awayName: string;
  homeForm: FormResult[];
  awayForm: FormResult[];
  homeHomeForm: FormResult[];
  awayAwayForm: FormResult[];
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Form splits
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="text-sm font-medium">{homeName}</div>
          <FormBadges form={homeForm} label="Overall" />
          <FormBadges form={homeHomeForm} label="Home" />
        </div>
        <div className="space-y-3">
          <div className="text-sm font-medium">{awayName}</div>
          <FormBadges form={awayForm} label="Overall" />
          <FormBadges form={awayAwayForm} label="Away" />
        </div>
      </div>
    </section>
  );
}

export function HeadToHeadPanel({ results }: { results: HeadToHeadResult[] }) {
  return (
    <section className="rounded-lg border border-[var(--line)] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Head to head
      </h2>
      {results.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No recent meetings in the dataset yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {results.map((result) => (
            <li
              key={result.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2 text-sm last:border-none"
            >
              <span className="text-[var(--muted)]">
                {formatKickoff(result.kickoff)}
              </span>
              <span>
                {result.homeName}{" "}
                <span className="font-[family-name:var(--font-display)] text-lg tracking-wide">
                  {result.homeScore}–{result.awayScore}
                </span>{" "}
                {result.awayName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

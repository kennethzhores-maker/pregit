import type { Injury, LineupStatus, MatchDetail } from "@/lib/data/types";
import { formatKickoff } from "@/lib/data/types";
import { FormBadges } from "@/components/form-badges";
import { kickoffLabel } from "@/lib/data/intelligence";

const lineupCopy: Record<LineupStatus, string> = {
  confirmed: "Confirmed XI",
  provisional: "Provisional XI",
  unavailable: "XI pending",
};

export function MatchHero({ match }: { match: MatchDetail }) {
  const scoreReady =
    match.homeScore !== null && match.awayScore !== null;

  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(47,158,98,0.16),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(214,179,92,0.12),transparent_40%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>{match.competition}</span>
          {match.round ? <span>· {match.round}</span> : null}
          <span className="rounded border border-[var(--line)] px-2 py-0.5 text-[var(--accent)]">
            {lineupCopy[match.lineupStatus]}
          </span>
          <span className="rounded border border-[var(--line)] px-2 py-0.5">
            {kickoffLabel(match.kickoff, match.status)}
          </span>
        </div>

        <p className="relative mt-3 text-sm text-[var(--muted)]">
          {formatKickoff(match.kickoff)} · {match.venue}
          {match.referee ? ` · Ref ${match.referee}` : ""}
        </p>

        <div className="relative mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-right">
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-6xl">
              {match.home.shortName}
            </h1>
            <p className="mt-1 text-[var(--muted)]">{match.home.name}</p>
            <div className="mt-3 flex justify-end">
              <FormBadges form={match.home.form} />
            </div>
          </div>

          <div className="px-2 text-center">
            <div className="font-[family-name:var(--font-display)] text-5xl tracking-wider sm:text-7xl">
              {scoreReady
                ? `${match.homeScore} – ${match.awayScore}`
                : "vs"}
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              {match.status}
            </p>
          </div>

          <div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-6xl">
              {match.away.shortName}
            </h1>
            <p className="mt-1 text-[var(--muted)]">{match.away.name}</p>
            <div className="mt-3">
              <FormBadges form={match.away.form} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function KeyAbsences({
  homeName,
  awayName,
  home,
  away,
}: {
  homeName: string;
  awayName: string;
  home: Injury[];
  away: Injury[];
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Key absences
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <AbsenceColumn team={homeName} injuries={home} />
        <AbsenceColumn team={awayName} injuries={away} />
      </div>
    </section>
  );
}

function AbsenceColumn({
  team,
  injuries,
}: {
  team: string;
  injuries: Injury[];
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{team}</div>
      {injuries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No listed absences</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {injuries.map((injury) => (
            <li
              key={injury.id}
              className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2"
            >
              <div>{injury.playerName}</div>
              <div className="text-xs text-rose-200/80">
                {injury.reason ?? injury.injuryType ?? "Unavailable"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

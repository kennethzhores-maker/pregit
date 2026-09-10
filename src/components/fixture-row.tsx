import Link from "next/link";

import {
  formatKickoff,
  type FixtureListItem,
} from "@/lib/data/types";

const statusLabel: Record<FixtureListItem["status"], string> = {
  scheduled: "Scheduled",
  lineups: "Lineups in",
  live: "Live",
  finished: "FT",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

const lineupLabel = {
  confirmed: "XI confirmed",
  provisional: "XI provisional",
  unavailable: "XI pending",
} as const;

function FormPips({ form }: { form: FixtureListItem["home"]["form"] }) {
  return (
    <div className="flex gap-1">
      {form.slice(-5).map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${
            result === "W"
              ? "bg-emerald-500/20 text-emerald-300"
              : result === "D"
                ? "bg-amber-400/15 text-amber-200"
                : "bg-rose-500/15 text-rose-300"
          }`}
          title={result}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

export function FixtureRow({
  fixture,
  followedTeamIds,
}: {
  fixture: FixtureListItem;
  followedTeamIds?: string[] | Set<string>;
}) {
  const followed =
    followedTeamIds instanceof Set
      ? followedTeamIds
      : new Set(followedTeamIds ?? []);
  const homeFollowed = followed.has(fixture.home.id);
  const awayFollowed = followed.has(fixture.away.id);
  const isFollowed = homeFollowed || awayFollowed;

  const score =
    fixture.homeScore !== null && fixture.awayScore !== null
      ? `${fixture.homeScore} – ${fixture.awayScore}`
      : "vs";

  return (
    <Link
      href={`/matches/${fixture.id}`}
      className={`group grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[var(--line)] px-1 py-4 transition hover:bg-[var(--panel-hover)] sm:gap-6 sm:px-3 ${
        isFollowed ? "bg-[var(--pitch)]/5" : ""
      }`}
    >
      <div className="flex flex-col items-end gap-1 text-right">
        <span
          className={`font-medium group-hover:text-[var(--accent)] ${
            homeFollowed ? "text-[var(--pitch)]" : "text-[var(--foreground)]"
          }`}
        >
          {fixture.home.name}
          {homeFollowed ? " ·" : ""}
        </span>
        <FormPips form={fixture.home.form} />
      </div>

      <div className="min-w-[5rem] text-center">
        <div className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--foreground)]">
          {score}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {statusLabel[fixture.status]}
        </div>
        {fixture.lineupStatus && fixture.status !== "finished" ? (
          <div className="mt-1 text-[10px] tracking-[0.08em] text-[var(--accent)]">
            {lineupLabel[fixture.lineupStatus]}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-1">
        <span
          className={`font-medium group-hover:text-[var(--accent)] ${
            awayFollowed ? "text-[var(--pitch)]" : "text-[var(--foreground)]"
          }`}
        >
          {awayFollowed ? "· " : ""}
          {fixture.away.name}
        </span>
        <FormPips form={fixture.away.form} />
      </div>

      <div className="col-span-3 flex items-center justify-between pt-1 text-xs text-[var(--muted)] sm:px-2">
        <span>{formatKickoff(fixture.kickoff)}</span>
        <span>{fixture.venue}</span>
      </div>
    </Link>
  );
}

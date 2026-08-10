import type { StatComparison } from "@/lib/data/intelligence";

export function StatComparisonBars({
  homeName,
  awayName,
  rows,
}: {
  homeName: string;
  awayName: string;
  rows: StatComparison[];
}) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-[var(--line)] p-5 text-sm text-[var(--muted)]">
        Season comparison unlocks once both teams have stats.
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--line)] p-5">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Season comparison
        </h2>
        <div className="hidden text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] sm:block">
          {homeName} · {awayName}
        </div>
      </div>

      <div className="space-y-5">
        {rows.map((row) => {
          const higherIsBetter = row.higherIsBetter !== false;
          const total = Math.abs(row.home) + Math.abs(row.away) || 1;
          const homeShare = (Math.abs(row.home) / total) * 100;
          const awayShare = (Math.abs(row.away) / total) * 100;
          const homeLeads = higherIsBetter
            ? row.home > row.away
            : row.home < row.away;
          const awayLeads = higherIsBetter
            ? row.away > row.home
            : row.away < row.home;

          const format = (value: number) =>
            row.format === "decimal" ? value.toFixed(2) : String(value);

          return (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span
                  className={
                    homeLeads ? "text-[var(--accent)]" : "text-[var(--muted)]"
                  }
                >
                  {format(row.home)}
                </span>
                <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  {row.label}
                </span>
                <span
                  className={
                    awayLeads ? "text-[var(--accent)]" : "text-[var(--muted)]"
                  }
                >
                  {format(row.away)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-[var(--panel-hover)]">
                <div
                  className="stat-bar bg-[var(--pitch)]"
                  style={{ width: `${homeShare}%` }}
                />
                <div
                  className="stat-bar bg-[var(--accent)]/80"
                  style={{ width: `${awayShare}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

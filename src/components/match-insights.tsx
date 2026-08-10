import type { Insight } from "@/lib/data/intelligence";

const toneClass = {
  positive: "border-[var(--pitch)]/40 bg-[var(--pitch)]/10 text-emerald-100",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  neutral: "border-[var(--line)] bg-[var(--panel-hover)] text-[var(--foreground)]",
} as const;

export function MatchInsights({ insights }: { insights: Insight[] }) {
  return (
    <section className="rounded-lg border border-[var(--line)] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Match read
      </h2>
      <ul className="mt-4 space-y-2">
        {insights.map((insight) => (
          <li
            key={insight.text}
            className={`insight-row rounded-md border px-3 py-2.5 text-sm leading-relaxed ${toneClass[insight.tone]}`}
          >
            {insight.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

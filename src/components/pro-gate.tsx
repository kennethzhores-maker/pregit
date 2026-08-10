import Link from "next/link";

import { MONETIZE_DISCLAIMER } from "@/lib/product/plans";

export function ProGate({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-xl border border-[var(--pitch)]/35 bg-[var(--panel)]/70 p-8 text-center">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
        Pro feature
      </div>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl tracking-wide">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-[var(--muted)]">
        {description}
      </p>
      <p className="mx-auto mt-3 max-w-lg text-xs text-[var(--muted)]">
        {MONETIZE_DISCLAIMER}
      </p>
      <Link
        href="/pricing"
        className="mt-6 inline-flex rounded-md bg-[var(--pitch)] px-5 py-2.5 text-sm font-medium text-[var(--pitch-ink)] transition hover:brightness-110"
      >
        View Pro plans
      </Link>
    </section>
  );
}

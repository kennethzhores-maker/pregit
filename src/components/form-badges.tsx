import type { FormResult } from "@/lib/data/types";

const labels: Record<FormResult, string> = {
  W: "W",
  D: "D",
  L: "L",
};

const styles: Record<FormResult, string> = {
  W: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  D: "bg-amber-400/15 text-amber-200 border-amber-400/35",
  L: "bg-rose-500/15 text-rose-300 border-rose-500/35",
};

export function FormBadges({
  form,
  label,
}: {
  form: FormResult[];
  label?: string;
}) {
  if (!form.length) {
    return (
      <div className="text-sm text-[var(--muted)]">
        {label ? `${label}: ` : ""}No form yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label ? (
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {label}
        </div>
      ) : null}
      <div className="flex gap-1.5">
        {form.slice(-5).map((result, index) => (
          <span
            key={`${result}-${index}`}
            className={`form-pip inline-flex h-7 w-7 items-center justify-center rounded border text-xs font-semibold ${styles[result]}`}
            style={{ animationDelay: `${index * 60}ms` }}
            title={result}
          >
            {labels[result]}
          </span>
        ))}
      </div>
    </div>
  );
}

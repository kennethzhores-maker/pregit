import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { SimulationArena } from "@/components/simulation/simulation-arena";
import { getSimulationCatalog } from "@/lib/simulation/catalog";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function SimulationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { teams, source } = await getSimulationCatalog();

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.08em] sm:text-5xl">
            Simulation
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Build two XIs from current squad lists and season stats, then watch a
            sped-up 90-minute match with live score, feed, and final match stats.
          </p>
        </div>

        {teams.length < 2 ? (
          <p className="rounded-xl border border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
            Need at least two squads with 11+ players. Seed pack should load by
            default — check sync if this is empty.
          </p>
        ) : (
          <SimulationArena teams={teams} source={source} />
        )}
      </main>
    </>
  );
}

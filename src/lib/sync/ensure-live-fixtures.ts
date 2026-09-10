import { getFootballDataToken } from "@/lib/football/football-data-client";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  syncFixturesFromFootballData,
  syncStandingsFromFootballData,
} from "@/lib/sync/sync-football-data";

let lastAutoSyncAt = 0;
const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * When the fixtures board is empty but football-data.org is configured,
 * pull current-season fixtures + standings once (cooldown-guarded).
 * Useful on fresh Vercel deploys where env vars exist but DB was never synced.
 */
export async function ensureLiveFixturesSynced(): Promise<{
  ran: boolean;
  message: string;
}> {
  if (!getFootballDataToken()) {
    return { ran: false, message: "FOOTBALL_DATA_TOKEN not set." };
  }
  if (!createServiceClient()) {
    return { ran: false, message: "Supabase service role not configured." };
  }

  const now = Date.now();
  if (now - lastAutoSyncAt < AUTO_SYNC_COOLDOWN_MS) {
    return { ran: false, message: "Auto-sync cooldown active." };
  }
  lastAutoSyncAt = now;

  const fixtures = await syncFixturesFromFootballData("nightly");
  const standings = await syncStandingsFromFootballData();

  return {
    ran: fixtures.status === "success" || standings.status === "success",
    message: `${fixtures.message} ${standings.message}`,
  };
}

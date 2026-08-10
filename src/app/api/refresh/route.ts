import { NextResponse } from "next/server";

import { getMatchDetail } from "@/lib/data/repository";
import { recordHealthEvent } from "@/lib/product/admin-health";
import { getCurrentUser } from "@/lib/supabase/server";
import { refreshMatchForKickoff } from "@/lib/sync/pre-kickoff";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    fixtureId?: string;
  };

  if (!body.fixtureId) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  try {
    const { match, refresh } = await refreshMatchForKickoff(body.fixtureId);
    recordHealthEvent("refresh", `Manual refresh ${body.fixtureId}`, {
      source: refresh.source,
      lineupStatus: refresh.lineupStatus,
    });
    return NextResponse.json({
      refresh,
      match: {
        id: match.id,
        status: match.status,
        lineupStatus: match.lineupStatus,
        homeLineup: match.homeLineup,
        awayLineup: match.awayLineup,
        injuries: match.injuries,
        home: match.home,
        away: match.away,
      },
    });
  } catch {
    recordHealthEvent("error", `Refresh failed for ${body.fixtureId}`);
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fixtureId = new URL(request.url).searchParams.get("fixtureId");
  if (!fixtureId) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  const match = await getMatchDetail(fixtureId);
  if (!match) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  return NextResponse.json({
    fixtureId,
    lineupStatus: match.lineupStatus,
    homeXiCount: match.homeLineup.length,
    awayXiCount: match.awayLineup.length,
    injuryCount: match.injuries.length,
  });
}

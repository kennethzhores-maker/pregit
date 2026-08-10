import { NextResponse } from "next/server";

import {
  getFollowedTeamIds,
  listFollowableTeams,
  toggleFollowTeam,
} from "@/lib/product/follows";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const followed = await getFollowedTeamIds(user.id);
  return NextResponse.json({
    followed,
    teams: listFollowableTeams(),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { teamId?: string };
  if (!body.teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const followed = await toggleFollowTeam(user.id, body.teamId);
  return NextResponse.json({ followed });
}

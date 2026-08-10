import { cookies } from "next/headers";

import { TEAMS } from "@/lib/data/seed";
import { FOLLOW_COOKIE } from "@/lib/product/config";

const memoryFollows = new Map<string, Set<string>>();

function parseFollows(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
}

export async function getFollowedTeamIds(userId: string): Promise<string[]> {
  const mem = memoryFollows.get(userId);
  if (mem) return [...mem];

  const cookieStore = await cookies();
  const ids = parseFollows(cookieStore.get(FOLLOW_COOKIE)?.value);
  memoryFollows.set(userId, new Set(ids));
  return ids;
}

export async function setFollowedTeamIds(userId: string, teamIds: string[]) {
  const unique = [...new Set(teamIds)];
  memoryFollows.set(userId, new Set(unique));
  const cookieStore = await cookies();
  cookieStore.set(FOLLOW_COOKIE, JSON.stringify(unique), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return unique;
}

export async function toggleFollowTeam(userId: string, teamId: string) {
  const current = await getFollowedTeamIds(userId);
  const next = current.includes(teamId)
    ? current.filter((id) => id !== teamId)
    : [...current, teamId];
  return setFollowedTeamIds(userId, next);
}

export function listFollowableTeams() {
  return TEAMS.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.shortName,
  }));
}

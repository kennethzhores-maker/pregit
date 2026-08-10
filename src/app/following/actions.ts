"use server";

import { revalidatePath } from "next/cache";

import { toggleFollowTeam } from "@/lib/product/follows";
import { getCurrentUser } from "@/lib/supabase/server";

export async function toggleFollowAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) return;

  await toggleFollowTeam(user.id, teamId);
  revalidatePath("/following");
  revalidatePath("/fixtures");
  revalidatePath("/matches", "layout");
}

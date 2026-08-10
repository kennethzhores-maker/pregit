"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { setUserPlan, type PlanId } from "@/lib/product/plans";
import { getCurrentUser } from "@/lib/supabase/server";

export async function setPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = String(formData.get("plan") ?? "free");
  const plan: PlanId = raw === "pro" ? "pro" : "free";
  await setUserPlan(user.id, plan);

  revalidatePath("/pricing");
  revalidatePath("/fixtures");
  revalidatePath("/history");
  revalidatePath("/accuracy");
  revalidatePath("/admin");
  revalidatePath("/matches", "layout");

  redirect(plan === "pro" ? "/fixtures" : "/pricing");
}

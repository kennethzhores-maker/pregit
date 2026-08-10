import { NextResponse } from "next/server";

import { getSimulationCatalog } from "@/lib/simulation/catalog";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const catalog = await getSimulationCatalog();
  return NextResponse.json(catalog);
}

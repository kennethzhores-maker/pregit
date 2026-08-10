import { NextResponse } from "next/server";

import { recordHealthEvent } from "@/lib/product/admin-health";
import { runSync, type SyncJob } from "@/lib/sync/run-sync";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Local/dev convenience when secret not set
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function executeSync(job: SyncJob) {
  const result = await runSync(job);
  if (result.status === "failed") {
    recordHealthEvent("error", `Sync ${job} failed`, { result });
  } else {
    recordHealthEvent("sync", `Sync ${job} ${result.status}`, { result });
  }
  return result;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    job?: SyncJob;
  };
  const job: SyncJob = body.job ?? "hourly";
  const result = await executeSync(job);
  const status = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status });
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const job = (searchParams.get("job") as SyncJob | null) ?? "hourly";
  const result = await executeSync(job);
  const status = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status });
}

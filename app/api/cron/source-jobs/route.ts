import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectSourcedJobs } from "@/lib/sourcing";

// Scheduled: pull translation jobs from the free sources, de-dupe against what
// we already have, and insert new ones as PENDING for admin review. Runs with
// the service-role key (no user session), guarded by CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const { rows, perConnector } = await collectSourcedJobs();

  let inserted = 0;
  if (rows.length) {
    // Skip anything we've already ingested (source_name + external_id).
    const { data: existing } = await supabase
      .from("jobs")
      .select("source_name, external_id")
      .in(
        "external_id",
        rows.map((r) => r.external_id)
      );
    const seen = new Set(
      (existing ?? []).map((e) => `${e.source_name}::${e.external_id}`)
    );
    const fresh = rows.filter((r) => !seen.has(`${r.source_name}::${r.external_id}`));

    if (fresh.length) {
      const { error, count } = await supabase
        .from("jobs")
        .insert(fresh, { count: "exact" });
      if (error) {
        return NextResponse.json(
          { error: error.message, connectors: perConnector },
          { status: 500 }
        );
      }
      inserted = count ?? fresh.length;
    }
  }

  return NextResponse.json({ inserted, connectors: perConnector });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

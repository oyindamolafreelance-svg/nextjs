import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateApplication } from "@/lib/ai/draft-application";
import type { Job } from "@/lib/types";

// Draft a tailored application message for a job. Approved members only.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.profile.is_approved) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const about = typeof body?.about === "string" ? body.about : "";
  if (!jobId) {
    return NextResponse.json({ error: "Missing job." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle<Job>();

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const { text, source } = await generateApplication(job, about);
  return NextResponse.json({ text, source });
}

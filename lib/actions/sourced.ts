"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

// Approve a sourced lead onto the live board. Refresh its date so it appears
// as newly published.
export async function approveSourcedJob(formData: FormData) {
  await requireAdmin();
  const jobId = String(formData.get("job_id") ?? "");
  if (!jobId) return;

  const supabase = await createClient();
  await supabase
    .from("jobs")
    .update({ review_status: "approved", date_posted: new Date().toISOString() })
    .eq("id", jobId);

  revalidatePath("/admin/sourced");
  revalidatePath("/jobs");
}

// Reject a sourced lead. Keep the row (marked rejected) so it isn't re-ingested.
export async function rejectSourcedJob(formData: FormData) {
  await requireAdmin();
  const jobId = String(formData.get("job_id") ?? "");
  if (!jobId) return;

  const supabase = await createClient();
  await supabase.from("jobs").update({ review_status: "rejected" }).eq("id", jobId);

  revalidatePath("/admin/sourced");
}

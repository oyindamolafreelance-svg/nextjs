"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export interface ApprovalState {
  error?: string;
}

// Approve a pending registration. Admin-gated by requireAdmin AND by RLS.
export async function approveUser(
  _prev: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Missing user id." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: true })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/dashboard");
  return {};
}

export interface JobFormState {
  error?: string;
  success?: boolean;
}

const DEFAULT_EXPIRY_DAYS = 30;

// Create a new job listing. expires_at is computed as date_posted + N days.
export async function createJob(
  _prev: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  await requireAdmin();

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const orNull = (v: string) => (v === "" ? null : v);

  const title = get("title");
  const language_pair = get("language_pair");
  const domain = get("domain");
  const work_type = get("work_type");
  const apply_contact = get("apply_contact");

  const missing = [
    ["title", title],
    ["language pair", language_pair],
    ["domain", domain],
    ["work type", work_type],
    ["apply contact", apply_contact],
  ]
    .filter(([, v]) => !v)
    .map(([label]) => label);

  if (missing.length) {
    return { error: `Please fill in the required field(s): ${missing.join(", ")}.` };
  }

  const rawDays = Number(get("expiry_days"));
  const expiryDays =
    Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : DEFAULT_EXPIRY_DAYS;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert({
    title,
    language_pair,
    domain,
    work_type,
    experience_required: orNull(get("experience_required")),
    apply_contact,
    description: orNull(get("description")),
    application_instructions: orNull(get("application_instructions")),
    source: orNull(get("source")),
    date_posted: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/jobs");
  revalidatePath("/admin/dashboard");
  return { success: true };
}

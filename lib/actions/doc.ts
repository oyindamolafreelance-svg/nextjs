"use server";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface StartDocInput {
  filename: string;
  kind: string;
  pageCount: number;
  targetLang: string;
  sourceLang?: string;
  domain?: string;
}

export type StartDocResult =
  | { ok: true; jobId: string; used: number; allowance: number }
  | { ok: false; error: string };

// Records a document-translation job and enforces the per-user daily ceiling
// (the free-tier cost guard). Returns the job id used to mark completion.
export async function startDocJob(input: StartDocInput): Promise<StartDocResult> {
  const user = await getSessionUser();
  if (!user?.profile.is_approved) {
    return { ok: false, error: "Not authorized." };
  }
  const supabase = await createClient();

  const [{ data: used }, { data: allowance }] = await Promise.all([
    supabase.rpc("my_docs_today"),
    supabase.rpc("my_doc_allowance"),
  ]);
  const usedN = typeof used === "number" ? used : 0;
  const allowanceN = typeof allowance === "number" ? allowance : 15;
  if (usedN >= allowanceN) {
    return {
      ok: false,
      error: `Daily limit reached (${allowanceN} documents/day). Please try again tomorrow.`,
    };
  }

  const { data, error } = await supabase
    .from("doc_jobs")
    .insert({
      user_id: user.id,
      filename: input.filename.slice(0, 300),
      kind: input.kind,
      page_count: Math.max(1, Math.floor(input.pageCount || 1)),
      target_lang: input.targetLang,
      source_lang: input.sourceLang ?? null,
      domain: input.domain ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Couldn't start the translation job." };
  }
  return { ok: true, jobId: data.id as string, used: usedN + 1, allowance: allowanceN };
}

// Marks a job complete or errored. Best-effort; failures are non-fatal.
export async function finishDocJob(jobId: string, status: "complete" | "error"): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("doc_jobs")
    .update({ status })
    .eq("id", jobId)
    .eq("user_id", user.id);
}

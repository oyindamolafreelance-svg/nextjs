"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth";

// Generate (or regenerate) the caller's clip token for the browser extension.
export async function generateClipToken() {
  const user = await requireApproved();
  const token = `clip_${randomBytes(24).toString("hex")}`;

  const supabase = await createClient();
  await supabase.from("profiles").update({ clip_token: token }).eq("id", user.id);

  revalidatePath("/settings");
}

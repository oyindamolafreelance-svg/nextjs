"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim() || null;
  const mediaTypeRaw = String(formData.get("mediaType") ?? "");
  const mediaType = mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO" ? mediaTypeRaw : null;
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

  if (!profileId) throw new Error("Choose a profile.");
  if (!caption) throw new Error("Caption is required.");

  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Profile not found.");

  let scheduledAt: Date | null = null;
  if (scheduledAtRaw) {
    scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid schedule date.");
  }

  await db.post.create({
    data: {
      profileId,
      caption,
      mediaUrl,
      mediaType,
      source: "MANUAL",
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
    },
  });

  revalidatePath("/posts");
  revalidatePath(`/profiles/${profileId}`);
  redirect("/posts");
}

export async function cancelSchedule(id: string) {
  const post = await db.post.update({
    where: { id },
    data: { status: "DRAFT", scheduledAt: null },
  });
  revalidatePath("/posts");
  revalidatePath(`/profiles/${post.profileId}`);
}

export async function deletePost(id: string) {
  const post = await db.post.delete({ where: { id } });
  revalidatePath("/posts");
  revalidatePath(`/profiles/${post.profileId}`);
}

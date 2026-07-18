"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function parseHashtags(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`));
}

function parseColors(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const platform = String(formData.get("platform") ?? "");
  const niche = String(formData.get("niche") ?? "").trim();
  const brandTone = String(formData.get("brandTone") ?? "").trim() || null;
  const brandColors = parseColors(String(formData.get("brandColors") ?? ""));
  const brandHashtags = parseHashtags(String(formData.get("brandHashtags") ?? ""));
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

  if (!name) throw new Error("Name is required.");
  if (platform !== "TIKTOK" && platform !== "FACEBOOK") throw new Error("Pick a platform.");
  if (!niche) throw new Error("Niche is required.");

  const profile = await db.profile.create({
    data: { name, platform, niche, brandTone, brandColors, brandHashtags, logoUrl },
  });

  revalidatePath("/profiles");
  redirect(`/profiles/${profile.id}`);
}

export async function updateProfile(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "").trim();
  const brandTone = String(formData.get("brandTone") ?? "").trim() || null;
  const brandColors = parseColors(String(formData.get("brandColors") ?? ""));
  const brandHashtags = parseHashtags(String(formData.get("brandHashtags") ?? ""));
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

  if (!name) throw new Error("Name is required.");
  if (!niche) throw new Error("Niche is required.");

  await db.profile.update({
    where: { id },
    data: { name, niche, brandTone, brandColors, brandHashtags, logoUrl },
  });

  revalidatePath(`/profiles/${id}`);
  revalidatePath("/profiles");
}

export async function deleteProfile(id: string) {
  await db.profile.delete({ where: { id } });
  revalidatePath("/profiles");
  redirect("/profiles");
}

export async function disconnectProfile(id: string) {
  await db.profile.update({
    where: { id },
    data: {
      connected: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      externalAccountId: null,
      externalPageId: null,
      accountName: null,
    },
  });
  revalidatePath(`/profiles/${id}`);
}

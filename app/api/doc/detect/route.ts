import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { detectDomainAndLanguage } from "@/lib/ai/translate";

// Approved members only: detect a document's domain + source language from a
// text sample, so the translator can apply the right glossary/terminology.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.profile.is_approved) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const sample = body?.sample;
  if (typeof sample !== "string") {
    return NextResponse.json({ error: "Missing sample text." }, { status: 400 });
  }
  const detection = await detectDomainAndLanguage(sample);
  return NextResponse.json(detection);
}

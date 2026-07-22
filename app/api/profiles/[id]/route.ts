import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const profile = await db.profile.findUnique({
    where: { id },
    omit: { accessToken: true, refreshToken: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const key of ["name", "niche", "brandTone", "logoUrl"] as const) {
    if (typeof body[key] === "string") data[key] = body[key];
  }
  for (const key of ["brandColors", "brandHashtags"] as const) {
    if (Array.isArray(body[key])) {
      data[key] = body[key].filter((v: unknown) => typeof v === "string");
    }
  }

  try {
    const profile = await db.profile.update({
      where: { id },
      data,
      omit: { accessToken: true, refreshToken: true },
    });
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await db.profile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
}

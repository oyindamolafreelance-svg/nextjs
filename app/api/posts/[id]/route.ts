import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const post = await db.post.findUnique({
    where: { id },
    include: { profile: { select: { id: true, name: true, platform: true, niche: true } } },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  return NextResponse.json({ post });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.caption === "string") data.caption = body.caption;
  if (typeof body.mediaUrl === "string" || body.mediaUrl === null) data.mediaUrl = body.mediaUrl;
  if (body.mediaType === "IMAGE" || body.mediaType === "VIDEO" || body.mediaType === null) {
    data.mediaType = body.mediaType;
  }

  if (body.scheduledAt === null) {
    data.scheduledAt = null;
    data.status = "DRAFT";
  } else if (typeof body.scheduledAt === "string") {
    const date = new Date(body.scheduledAt);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "scheduledAt is not a valid date" }, { status: 400 });
    }
    data.scheduledAt = date;
    data.status = "SCHEDULED";
  }

  if (typeof body.status === "string" && ["DRAFT", "SCHEDULED"].includes(body.status)) {
    data.status = body.status;
  }

  try {
    const post = await db.post.update({ where: { id }, data });
    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await db.post.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
}

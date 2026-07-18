import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPublisher } from "@/lib/publishers";
import type { MediaType } from "@/lib/publishers/types";

// Video publishing can involve a few status polls; give this route room to run.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 501 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const duePosts = await db.post.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    include: { profile: true },
    take: 20,
    orderBy: { scheduledAt: "asc" },
  });

  const results = [];

  for (const post of duePosts) {
    await db.post.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });

    try {
      if (!post.profile.connected || !post.profile.accessToken) {
        throw new Error(`Profile "${post.profile.name}" is not connected to ${post.profile.platform}.`);
      }

      const publisher = getPublisher(post.profile.platform);
      const result = await publisher.publish(
        {
          accessToken: post.profile.accessToken,
          externalAccountId: post.profile.externalAccountId,
          externalPageId: post.profile.externalPageId,
        },
        {
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType as MediaType | null,
        }
      );

      await db.post.update({
        where: { id: post.id },
        data: {
          // "pending" posts (e.g. TikTok/Facebook still processing video) stay in
          // PUBLISHING and need a manual status check from the dashboard for now.
          status: result.pending ? "PUBLISHING" : "PUBLISHED",
          externalPostId: result.externalPostId,
          publishedAt: result.pending ? null : new Date(),
          error: null,
        },
      });
      results.push({ id: post.id, ok: true, pending: result.pending ?? false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.post.update({
        where: { id: post.id },
        data: { status: "FAILED", error: message },
      });
      results.push({ id: post.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

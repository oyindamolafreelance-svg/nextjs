import { db } from "@/lib/db";
import { PostComposer } from "./PostComposer";

export const dynamic = "force-dynamic";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const profiles = await db.profile.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, platform: true, niche: true },
  });

  const defaultProfileId = typeof sp.profileId === "string" ? sp.profileId : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New post</h1>
      <PostComposer profiles={profiles} defaultProfileId={defaultProfileId} />
    </div>
  );
}

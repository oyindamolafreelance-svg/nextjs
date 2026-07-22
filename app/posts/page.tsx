import Link from "next/link";
import { db } from "@/lib/db";
import { cancelSchedule, deletePost } from "@/lib/actions/posts";
import { ConfirmSubmit } from "@/app/_components/ConfirmSubmit";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await db.post.findMany({
    include: { profile: { select: { name: true, platform: true } } },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Posts</h1>
        <Link
          href="/posts/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">No posts yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{post.profile.name}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    {post.profile.platform}
                  </span>
                  <StatusBadge status={post.status} />
                </div>
                <p className="mt-1 truncate text-sm text-black/70 dark:text-white/70">
                  {post.caption}
                </p>
                {post.scheduledAt && (
                  <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                    Scheduled for {post.scheduledAt.toLocaleString()}
                  </p>
                )}
                {post.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{post.error}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {post.status === "SCHEDULED" && (
                  <form action={cancelSchedule.bind(null, post.id)}>
                    <button
                      type="submit"
                      className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
                    >
                      Unschedule
                    </button>
                  </form>
                )}
                <form action={deletePost.bind(null, post.id)}>
                  <ConfirmSubmit
                    label="Delete"
                    confirmMessage="Delete this post?"
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
                  />
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-black/5 dark:bg-white/10",
    SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    PUBLISHING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}

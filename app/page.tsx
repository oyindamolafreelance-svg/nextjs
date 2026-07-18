import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [profileCount, connectedCount, upcoming, failed] = await Promise.all([
    db.profile.count(),
    db.profile.count({ where: { connected: true } }),
    db.post.findMany({
      where: { status: "SCHEDULED" },
      include: { profile: { select: { name: true, platform: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    db.post.findMany({
      where: { status: "FAILED" },
      include: { profile: { select: { name: true, platform: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Keep TikTok and Facebook posting on autopilot, on-brand, per niche.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Profiles" value={profileCount} />
        <Stat label="Connected" value={connectedCount} />
        <Stat label="Scheduled" value={upcoming.length} />
        <Stat label="Failed" value={failed.length} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Upcoming posts</h2>
            <Link href="/posts" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">Nothing scheduled yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((post) => (
                <li key={post.id} className="text-sm">
                  <span className="font-medium">{post.profile.name}</span>{" "}
                  <span className="text-black/50 dark:text-white/50">
                    ({post.profile.platform}) — {post.scheduledAt?.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <h2 className="mb-3 font-medium">Recent failures</h2>
          {failed.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">No failures. Nice.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {failed.map((post) => (
                <li key={post.id} className="text-sm">
                  <span className="font-medium">{post.profile.name}</span>{" "}
                  <span className="text-red-600 dark:text-red-400">{post.error}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {profileCount === 0 && (
        <div className="rounded-lg border border-dashed border-black/20 p-6 text-center dark:border-white/20">
          <p className="mb-3 text-sm text-black/60 dark:text-white/60">
            Create your first profile to pick a platform, niche, and brand kit.
          </p>
          <Link
            href="/profiles/new"
            className="inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            New profile
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-black/50 dark:text-white/50">{label}</div>
    </div>
  );
}

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAdmin("/admin/dashboard");
  const supabase = await createClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const weekAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [pendingRes, weekRes, activeRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .gte("date_posted", weekAgoIso),
    supabase
      .from("jobs")
      .select("language_pair")
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
  ]);

  const pendingCount = pendingRes.count ?? 0;
  const postedThisWeek = weekRes.count ?? 0;
  const activeCount = activeRes.data?.length ?? 0;

  const pairCounts = new Map<string, number>();
  for (const row of activeRes.data ?? []) {
    const key = row.language_pair;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxPair = topPairs[0]?.[1] ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pending approvals" value={pendingCount} href="/admin/approvals" />
        <Stat label="Jobs posted this week" value={postedThisWeek} />
        <Stat label="Active listings" value={activeCount} href="/jobs" />
      </section>

      <section className="rounded-lg border border-black/10 p-5 dark:border-white/10">
        <h2 className="mb-4 font-medium">
          Most common language pairs (active listings)
        </h2>
        {topPairs.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            No active listings yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {topPairs.map(([pair, count]) => (
              <li key={pair} className="flex items-center gap-3 text-sm">
                <span className="w-48 shrink-0 truncate">{pair}</span>
                <span
                  className="h-2 rounded-full bg-black/70 dark:bg-white/70"
                  style={{
                    width: `${maxPair ? Math.max(8, (count / maxPair) * 100) : 0}%`,
                  }}
                  aria-hidden
                />
                <span className="tabular-nums text-black/60 dark:text-white/60">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-black/10 p-5 dark:border-white/10">
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">{label}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

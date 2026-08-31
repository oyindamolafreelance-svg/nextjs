import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ViewRow {
  job_id: string;
  viewer_id: string;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AnalyticsPage() {
  await requireAdmin("/admin/analytics");
  const supabase = await createClient();

  const [viewsRes, jobsRes, profilesRes] = await Promise.all([
    supabase
      .from("job_views")
      .select("job_id, viewer_id, created_at")
      .order("created_at", { ascending: false })
      .returns<ViewRow[]>(),
    supabase.from("jobs").select("id, title"),
    supabase.from("profiles").select("id, email, full_name"),
  ]);

  const views = viewsRes.data ?? [];
  const jobTitle = new Map((jobsRes.data ?? []).map((j) => [j.id, j.title]));
  const person = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email])
  );

  // Group clicks by job → { count, viewers (name → count), lastAt }.
  const byJob = new Map<
    string,
    { count: number; viewers: Map<string, number>; lastAt: string }
  >();
  for (const v of views) {
    const entry =
      byJob.get(v.job_id) ??
      { count: 0, viewers: new Map<string, number>(), lastAt: v.created_at };
    entry.count += 1;
    const who = person.get(v.viewer_id) ?? "Unknown";
    entry.viewers.set(who, (entry.viewers.get(who) ?? 0) + 1);
    if (v.created_at > entry.lastAt) entry.lastAt = v.created_at;
    byJob.set(v.job_id, entry);
  }

  const rows = [...byJob.entries()].sort((a, b) => b[1].count - a[1].count);
  const totalClicks = views.length;
  const uniqueViewers = new Set(views.map((v) => v.viewer_id)).size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Apply-click analytics</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Who clicked “apply” on each listing. Visible to admins only.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-black/10 p-5 dark:border-white/10">
          <p className="text-3xl font-semibold tabular-nums">{totalClicks}</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Total apply clicks
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-5 dark:border-white/10">
          <p className="text-3xl font-semibold tabular-nums">{uniqueViewers}</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Unique members who clicked
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">No apply clicks yet.</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            When members click “apply” on a listing, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(([jobId, entry]) => (
            <li
              key={jobId}
              className="rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">
                  {jobTitle.get(jobId) ?? "(deleted listing)"}
                </h2>
                <span className="text-sm text-black/60 dark:text-white/60">
                  {entry.count} click{entry.count === 1 ? "" : "s"} · last{" "}
                  {formatDate(entry.lastAt)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...entry.viewers.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([who, n]) => (
                    <span
                      key={who}
                      className="rounded-full bg-black/[.06] px-2.5 py-0.5 text-xs dark:bg-white/10"
                    >
                      {who}
                      {n > 1 ? ` ×${n}` : ""}
                    </span>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

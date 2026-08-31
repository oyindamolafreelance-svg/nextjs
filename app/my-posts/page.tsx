import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";
import { DeleteJobButton } from "./DeleteJobButton";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MyPostsPage() {
  const user = await requireApproved("/my-posts");
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("posted_by", user.id)
    .order("date_posted", { ascending: false })
    .returns<Job[]>();

  // Apply-click counts for the user's own listings (allowed by RLS).
  const ids = (jobs ?? []).map((j) => j.id);
  const clicks = new Map<string, number>();
  if (ids.length) {
    const { data: views } = await supabase
      .from("job_views")
      .select("job_id")
      .in("job_id", ids);
    for (const v of views ?? [])
      clicks.set(v.job_id, (clicks.get(v.job_id) ?? 0) + 1);
  }

  const now = new Date().getTime();
  const isLive = (j: Job) =>
    j.is_active && (!j.expires_at || new Date(j.expires_at).getTime() > now);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My posts</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Listings you&apos;ve posted, with how many members clicked to apply.
        </p>
      </div>

      {!jobs || jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">You haven&apos;t posted any jobs yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="font-medium">{job.title}</p>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {job.language_pair} · {job.domain} · posted{" "}
                  {formatDate(job.date_posted)}
                </p>
                <p className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 font-medium " +
                      (isLive(job)
                        ? "bg-green-600/10 text-green-700 dark:text-green-300"
                        : "bg-black/[.06] text-black/60 dark:bg-white/10 dark:text-white/60")
                    }
                  >
                    {isLive(job) ? "Live" : "Expired / inactive"}
                  </span>
                  <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-black/70 dark:bg-white/10 dark:text-white/70">
                    {clicks.get(job.id) ?? 0} apply click
                    {(clicks.get(job.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
              <DeleteJobButton jobId={job.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";
import { JobCard } from "../jobs/JobCard";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await requireApproved("/saved");
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("job_bookmarks")
    .select("job_id")
    .eq("user_id", user.id);

  const ids = (rows ?? []).map((r) => r.job_id);

  // RLS still applies to jobs, so listings you can't currently view (e.g. while
  // the daily gate is locked) simply won't come back.
  let jobs: Job[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .in("id", ids)
      .order("date_posted", { ascending: false })
      .returns<Job[]>();
    jobs = data ?? [];
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Saved jobs</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Listings you&apos;ve bookmarked.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Tap “☆ Save” on any listing to keep it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} saved />
          ))}
        </div>
      )}
    </div>
  );
}

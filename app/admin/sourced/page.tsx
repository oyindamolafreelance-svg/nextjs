import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";
import { SourcedActions } from "./SourcedActions";

export const dynamic = "force-dynamic";

export default async function SourcedPage() {
  await requireAdmin("/admin/sourced");
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("review_status", "pending")
    .order("date_posted", { ascending: false })
    .limit(200)
    .returns<Job[]>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sourced leads</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Jobs pulled automatically from free sources. Approve the good ones
          onto the board, or reject the rest.
        </p>
      </div>

      {!jobs || jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">No pending leads right now.</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            The sourcing job files new finds here for review.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-black/60 dark:text-white/60">
                    {job.language_pair} · {job.domain} · {job.work_type}
                  </p>
                  <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                    Source: {job.source_name}
                  </p>
                </div>
                <SourcedActions jobId={job.id} />
              </div>

              {job.description && (
                <p className="line-clamp-4 whitespace-pre-line text-sm text-black/70 dark:text-white/70">
                  {job.description}
                </p>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <span className="text-black/50 dark:text-white/50">Apply: </span>
                  <span className="font-medium break-all">{job.apply_contact}</span>
                </span>
                {job.source_url && (
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline dark:text-blue-400"
                  >
                    View original ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

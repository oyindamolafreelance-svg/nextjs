import type { Job } from "@/lib/types";
import { ApplyLink } from "./ApplyLink";
import { JobActions } from "./JobActions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Renders a listing to a member. Deliberately omits `source` (admin-only).
export function JobCard({ job, saved = false }: { job: Job; saved?: boolean }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-black/10 p-5 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{job.title}</h3>
        <span className="whitespace-nowrap text-xs text-black/50 dark:text-white/50">
          Posted {formatDate(job.date_posted)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Tag>{job.language_pair}</Tag>
        <Tag>{job.domain}</Tag>
        <Tag>{job.work_type}</Tag>
        {job.experience_required && <Tag muted>{job.experience_required}</Tag>}
      </div>

      {job.description && (
        <p className="whitespace-pre-line text-sm text-black/80 dark:text-white/80">
          {job.description}
        </p>
      )}

      {job.application_instructions && (
        <div className="rounded-md bg-black/[.03] p-3 text-sm text-black/70 dark:bg-white/[.04] dark:text-white/70">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
            How to apply
          </p>
          <p className="whitespace-pre-line">{job.application_instructions}</p>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3 text-sm dark:border-white/5">
        <div>
          <span className="text-black/50 dark:text-white/50">Apply: </span>
          <ApplyLink jobId={job.id} contact={job.apply_contact} />
        </div>
        <JobActions jobId={job.id} initialSaved={saved} />
      </div>
    </article>
  );
}

function Tag({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={
        "rounded-full px-2.5 py-0.5 text-xs font-medium " +
        (muted
          ? "border border-black/15 text-black/60 dark:border-white/20 dark:text-white/60"
          : "bg-black/[.06] text-black/80 dark:bg-white/10 dark:text-white/80")
      }
    >
      {children}
    </span>
  );
}

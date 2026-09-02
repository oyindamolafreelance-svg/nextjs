import type { Job } from "@/lib/types";
import { ApplyLink } from "./ApplyLink";
import { JobActions } from "./JobActions";
import { DraftApplication } from "./DraftApplication";

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
    <article className="card flex flex-col gap-3 p-5 transition-shadow hover:shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{job.title}</h3>
        <span className="whitespace-nowrap text-xs muted">
          {formatDate(job.date_posted)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="chip">{job.language_pair}</span>
        <span className="chip">{job.domain}</span>
        <span className="chip">{job.work_type}</span>
        {job.experience_required && (
          <span className="chip chip-muted">{job.experience_required}</span>
        )}
      </div>

      {job.description && (
        <p className="whitespace-pre-line text-sm text-[color:var(--fg)]/85">
          {job.description}
        </p>
      )}

      {job.application_instructions && (
        <div className="surface-2 rounded-xl p-3 text-sm muted">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
            How to apply
          </p>
          <p className="whitespace-pre-line">{job.application_instructions}</p>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t divider pt-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            <span className="muted">Apply: </span>
            <ApplyLink jobId={job.id} contact={job.apply_contact} />
          </span>
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs muted underline"
            >
              View original ↗
            </a>
          )}
        </div>
        <JobActions jobId={job.id} initialSaved={saved} />
      </div>

      <DraftApplication jobId={job.id} />
    </article>
  );
}

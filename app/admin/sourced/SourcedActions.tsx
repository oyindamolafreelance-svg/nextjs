"use client";

import { approveSourcedJob, rejectSourcedJob } from "@/lib/actions/sourced";

export function SourcedActions({ jobId }: { jobId: string }) {
  return (
    <div className="flex gap-2">
      <form action={approveSourcedJob}>
        <input type="hidden" name="job_id" value={jobId} />
        <button
          type="submit"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Approve
        </button>
      </form>
      <form action={rejectSourcedJob}>
        <input type="hidden" name="job_id" value={jobId} />
        <button
          type="submit"
          className="rounded-md border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
        >
          Reject
        </button>
      </form>
    </div>
  );
}

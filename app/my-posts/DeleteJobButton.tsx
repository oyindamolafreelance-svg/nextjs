"use client";

import { deleteJob } from "@/lib/actions/jobs";

export function DeleteJobButton({ jobId }: { jobId: string }) {
  return (
    <form
      action={deleteJob}
      onSubmit={(e) => {
        if (!confirm("Delete this listing? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="job_id" value={jobId} />
      <button
        type="submit"
        className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
      >
        Delete
      </button>
    </form>
  );
}

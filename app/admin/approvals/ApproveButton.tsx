"use client";

import { useActionState } from "react";
import { approveUser, type ApprovalState } from "@/lib/actions/jobs";

const initial: ApprovalState = {};

export function ApproveButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(approveUser, initial);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="user_id" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {pending ? "Approving…" : "Approve"}
      </button>
      {state.error && (
        <span className="text-sm text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}

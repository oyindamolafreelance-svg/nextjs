"use client";

import { useState } from "react";

export function JobActions({
  jobId,
  initialSaved,
}: {
  jobId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [savePending, setSavePending] = useState(false);
  const [reported, setReported] = useState(false);

  async function toggleSave() {
    setSavePending(true);
    // Optimistic flip; revert on failure.
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/jobs/${jobId}/bookmark`, { method: "POST" });
      const data = await res.json();
      if (typeof data?.saved === "boolean") setSaved(data.saved);
      else if (!res.ok) setSaved(!next);
    } catch {
      setSaved(!next);
    } finally {
      setSavePending(false);
    }
  }

  async function report() {
    const reason = window.prompt(
      "Why are you reporting this listing? (optional — e.g. spam, duplicate, scam)"
    );
    if (reason === null) return; // cancelled
    try {
      await fetch(`/api/jobs/${jobId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setReported(true);
    } catch {
      // ignore — non-critical
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={toggleSave}
        disabled={savePending}
        className={
          "rounded-full border px-2.5 py-1 font-medium transition-colors " +
          (saved
            ? "border-black/30 bg-black/[.06] dark:border-white/40 dark:bg-white/10"
            : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10")
        }
        aria-pressed={saved}
      >
        {saved ? "★ Saved" : "☆ Save"}
      </button>
      <button
        type="button"
        onClick={report}
        disabled={reported}
        className="text-black/40 hover:text-black/70 disabled:opacity-60 dark:text-white/40 dark:hover:text-white/70"
      >
        {reported ? "Reported ✓" : "Report"}
      </button>
    </div>
  );
}

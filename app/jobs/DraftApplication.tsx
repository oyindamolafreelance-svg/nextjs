"use client";

import { useEffect, useState } from "react";

const ABOUT_KEY = "lb_about_me";

export function DraftApplication({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  // Remember the "about you" note across jobs (per-browser convenience only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ABOUT_KEY) ?? "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setAbout(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function generate() {
    setStatus("loading");
    setNote("");
    try {
      localStorage.setItem(ABOUT_KEY, about);
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/draft-application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, about }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setNote(data?.error ?? "Couldn't draft right now.");
        return;
      }
      setText(data.text ?? "");
      setStatus("done");
      setNote(
        data.source === "template"
          ? "Drafted from a template (AI was unavailable) — please personalize."
          : "Drafted by AI — review and edit before sending."
      );
    } catch {
      setStatus("error");
      setNote("Couldn't draft right now.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-400"
      >
        ✍️ Draft application
      </button>
    );
  }

  return (
    <div className="mt-2 flex w-full flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/10">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">About you (optional — reused next time)</span>
        <input
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="e.g. EN→FR translator, 5 yrs legal, Trados, native French"
          className="rounded border border-black/15 bg-transparent px-2 py-1.5 dark:border-white/20"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={status === "loading"}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {status === "loading" ? "Writing…" : text ? "Regenerate" : "Generate"}
        </button>
        {text && (
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1.5 text-xs text-black/50 hover:text-current dark:text-white/50"
        >
          Close
        </button>
      </div>

      {note && (
        <p
          className={
            "text-xs " +
            (status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-black/50 dark:text-white/50")
          }
        >
          {note}
        </p>
      )}

      {text && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
        />
      )}
    </div>
  );
}

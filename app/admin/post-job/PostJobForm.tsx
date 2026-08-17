"use client";

import { useActionState, useEffect, useState } from "react";
import { createJob, type JobFormState } from "@/lib/actions/jobs";
import type { ParsedJobFields } from "@/lib/types";

const initial: JobFormState = {};

const EMPTY = {
  title: "",
  language_pair: "",
  domain: "",
  work_type: "",
  experience_required: "",
  apply_contact: "",
  application_instructions: "",
  source: "",
  expiry_days: "30",
};

const inputCls =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export function PostJobForm() {
  const [state, action, pending] = useActionState(createJob, initial);
  const [fields, setFields] = useState({ ...EMPTY });
  const [rawText, setRawText] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState(false);

  // Clear the form once a listing posts successfully.
  useEffect(() => {
    if (state.success) {
      setFields({ ...EMPTY });
      setRawText("");
      setAiFilled(false);
    }
  }, [state.success]);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  async function autofill() {
    setAiPending(true);
    setAiError(null);
    try {
      const res = await fetch("/api/parse-job", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data?.error ?? "Auto-fill failed.");
        return;
      }
      const parsed = data.fields as ParsedJobFields;
      setFields((f) => ({
        ...f,
        title: parsed.title || f.title,
        language_pair: parsed.language_pair || f.language_pair,
        domain: parsed.domain || f.domain,
        work_type: parsed.work_type || f.work_type,
        experience_required: parsed.experience_required || f.experience_required,
        apply_contact: parsed.apply_contact || f.apply_contact,
        application_instructions:
          parsed.application_instructions || f.application_instructions,
      }));
      setAiFilled(true);
    } catch {
      setAiError("Auto-fill failed. Please try again.");
    } finally {
      setAiPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* AI auto-fill helper */}
      <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-5 dark:border-white/10">
        <div>
          <h2 className="font-medium">Auto-fill from a pasted posting</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Paste the raw job text you copied from ProZ, LinkedIn, an agency
            site, etc. The AI will fill in the structured fields below for you to
            review and edit before posting.
          </p>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
          placeholder="Paste the full job posting here…"
          className={inputCls}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={autofill}
            disabled={aiPending || !rawText.trim()}
            className="rounded-md border border-black/20 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
          >
            {aiPending ? "Reading posting…" : "Auto-fill fields"}
          </button>
          {aiFilled && !aiError && (
            <span className="text-sm text-green-700 dark:text-green-400">
              Fields filled — review and edit below.
            </span>
          )}
          {aiError && (
            <span className="text-sm text-red-600 dark:text-red-400">{aiError}</span>
          )}
        </div>
      </section>

      {/* Structured job form */}
      <form action={action} className="flex flex-col gap-4">
        <Field label="Title" required>
          <input
            name="title"
            value={fields.title}
            onChange={(e) => set("title", e.target.value)}
            required
            className={inputCls}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Language pair" required>
            <input
              name="language_pair"
              value={fields.language_pair}
              onChange={(e) => set("language_pair", e.target.value)}
              required
              placeholder="English → French"
              className={inputCls}
            />
          </Field>
          <Field label="Domain" required>
            <input
              name="domain"
              value={fields.domain}
              onChange={(e) => set("domain", e.target.value)}
              required
              placeholder="legal, medical, technical…"
              className={inputCls}
            />
          </Field>
          <Field label="Work type" required>
            <input
              name="work_type"
              value={fields.work_type}
              onChange={(e) => set("work_type", e.target.value)}
              required
              placeholder="translation, MTPE, subtitling…"
              className={inputCls}
            />
          </Field>
          <Field label="Experience required">
            <input
              name="experience_required"
              value={fields.experience_required}
              onChange={(e) => set("experience_required", e.target.value)}
              placeholder="3+ years, entry-level ok…"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Apply contact (email and/or URL)" required>
          <input
            name="apply_contact"
            value={fields.apply_contact}
            onChange={(e) => set("apply_contact", e.target.value)}
            required
            placeholder="jobs@agency.com or https://…"
            className={inputCls}
          />
        </Field>

        <Field label="Application instructions">
          <textarea
            name="application_instructions"
            value={fields.application_instructions}
            onChange={(e) => set("application_instructions", e.target.value)}
            rows={4}
            placeholder="Required documents, subject line, deadline, rate info…"
            className={inputCls}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source (admin only, not shown to members)">
            <input
              name="source"
              value={fields.source}
              onChange={(e) => set("source", e.target.value)}
              placeholder="ProZ, LinkedIn, company site…"
              className={inputCls}
            />
          </Field>
          <Field label="Expires after (days)">
            <input
              name="expiry_days"
              type="number"
              min={1}
              value={fields.expiry_days}
              onChange={(e) => set("expiry_days", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        {state.success && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Listing posted. The form has been cleared for the next one.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 self-start rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {pending ? "Posting…" : "Post listing"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {label}
        {required && <span className="text-red-600 dark:text-red-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

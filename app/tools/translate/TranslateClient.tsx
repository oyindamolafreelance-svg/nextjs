"use client";

import { useRef, useState } from "react";
import { loadOffice, isSupportedOffice, type OfficeDoc } from "@/lib/docs/office";
import { LANGUAGES, isLowResource } from "@/lib/docs/languages";
import { DOMAINS } from "@/lib/ai/glossaries";
import { startDocJob, finishDocJob } from "@/lib/actions/doc";

type Phase = "idle" | "reading" | "detecting" | "translating" | "done" | "error";

// How many paragraph segments to send per request — keeps each serverless call
// well under the function timeout.
const CHUNK = 40;

interface DownloadReady {
  url: string;
  filename: string;
}

export function TranslateClient({
  used,
  allowance,
  unlimited,
}: {
  used: number;
  allowance: number;
  unlimited: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("English");
  const [sourceLang, setSourceLang] = useState("auto");
  const [domain, setDomain] = useState("auto");

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<{ domainLabel: string; sourceLanguage: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<DownloadReady | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "reading" || phase === "detecting" || phase === "translating";
  const remaining = Math.max(0, allowance - used);

  function reset() {
    setPhase("idle");
    setProgress(0);
    setDetected(null);
    setError(null);
    if (download) URL.revokeObjectURL(download.url);
    setDownload(null);
  }

  function onPick(f: File | null) {
    reset();
    if (f && !isSupportedOffice(f.name)) {
      setError("Unsupported file. Phase 1 supports .docx, .pptx and .xlsx (PDF & scans are coming next).");
      setFile(null);
      return;
    }
    setFile(f);
  }

  function outName(original: string, lang: string): string {
    const dot = original.lastIndexOf(".");
    const base = dot === -1 ? original : original.slice(0, dot);
    const ext = dot === -1 ? "" : original.slice(dot);
    const tag = lang.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return `${base}.${tag}${ext}`;
  }

  async function translateChunk(segments: string[], dom: string): Promise<string[]> {
    const res = await fetch("/api/doc/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ segments, targetLang, sourceLang, domain: dom }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || `Translation failed (${res.status}).`);
    }
    if (!Array.isArray(data?.translations) || data.translations.length !== segments.length) {
      throw new Error("Translation service returned a mismatched result. Please retry.");
    }
    return data.translations as string[];
  }

  async function run() {
    if (!file) return;
    reset();
    let jobId: string | null = null;
    try {
      // 1. Parse the document in the browser.
      setPhase("reading");
      let doc: OfficeDoc;
      try {
        doc = await loadOffice(file);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Couldn't read that file.");
      }
      if (doc.segments.length === 0) {
        throw new Error("No translatable text was found in this document.");
      }

      // 2. Detect domain + source language from a sample.
      setPhase("detecting");
      const sample = doc.segments.filter((s) => s.trim()).slice(0, 30).join("\n").slice(0, 3500);
      let detectedDomain = "general";
      let detectedLang = "unknown";
      try {
        const dres = await fetch("/api/doc/detect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sample }),
        });
        const dj = await dres.json().catch(() => null);
        if (dres.ok && dj) {
          detectedDomain = dj.domain || "general";
          detectedLang = dj.sourceLanguage || "unknown";
          setDetected({ domainLabel: dj.domainLabel || "General", sourceLanguage: detectedLang });
        }
      } catch {
        // Detection is best-effort; fall back to general.
      }
      const effectiveDomain = domain === "auto" ? detectedDomain : domain;

      // 3. Register the job (enforces the daily ceiling).
      const started = await startDocJob({
        filename: file.name,
        kind: doc.kind,
        pageCount: doc.pageEstimate,
        targetLang,
        sourceLang: sourceLang === "auto" ? detectedLang : sourceLang,
        domain: effectiveDomain,
      });
      if (!started.ok) {
        throw new Error(started.error);
      }
      jobId = started.jobId;

      // 4. Translate in chunks (sequential — friendly to free-tier rate limits).
      setPhase("translating");
      const all = doc.segments;
      const output = new Array<string>(all.length);
      let done = 0;
      for (let i = 0; i < all.length; i += CHUNK) {
        const slice = all.slice(i, i + CHUNK);
        const translated = await translateChunk(slice, effectiveDomain);
        for (let k = 0; k < translated.length; k++) output[i + k] = translated[k];
        done += slice.length;
        setProgress(Math.round((done / all.length) * 100));
      }

      // 5. Rebuild the file and offer the download.
      const blob = await doc.build(output);
      const url = URL.createObjectURL(blob);
      setDownload({ url, filename: outName(file.name, targetLang) });
      setPhase("done");
      await finishDocJob(jobId, "complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setPhase("error");
      if (jobId) await finishDocJob(jobId, "error").catch(() => {});
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Quota */}
      <div className="card p-4 text-sm">
        {unlimited ? (
          <p className="muted">Unlimited document translations on your account.</p>
        ) : (
          <p className="muted">
            {remaining} of {allowance} document translations left today.
          </p>
        )}
      </div>

      {/* File picker */}
      <div className="card p-5">
        <label className="mb-2 block text-sm font-medium">Document</label>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.pptx,.xlsx"
          disabled={busy}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--brand)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {file && (
          <p className="mt-2 text-sm muted">
            Selected: <span className="font-medium">{file.name}</span>
          </p>
        )}
        <p className="mt-2 text-xs muted">
          Phase 1 supports Word (.docx), PowerPoint (.pptx) and Excel (.xlsx).
          PDF and scanned documents are coming in the next phases.
        </p>
      </div>

      {/* Options */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Translate into</label>
          <select
            className="input"
            value={targetLang}
            disabled={busy}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
                {l.lowResource ? " (limited)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">From</label>
          <select
            className="input"
            value={sourceLang}
            disabled={busy}
            onChange={(e) => setSourceLang(e.target.value)}
          >
            <option value="auto">Auto-detect</option>
            {LANGUAGES.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Domain</label>
          <select
            className="input"
            value={domain}
            disabled={busy}
            onChange={(e) => setDomain(e.target.value)}
          >
            <option value="auto">Auto-detect</option>
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLowResource(targetLang) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <strong>{targetLang}</strong> is a lower-resource language — free AI
          quality is less reliable here. Always have a human review the output
          before sending.
        </div>
      )}

      {/* Detected info */}
      {detected && (
        <p className="text-sm muted">
          Detected domain: <span className="font-medium">{detected.domainLabel}</span>
          {detected.sourceLanguage !== "unknown" && (
            <>
              {" · "}source language:{" "}
              <span className="font-medium">{detected.sourceLanguage}</span>
            </>
          )}
        </p>
      )}

      {/* Action */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!file || busy || (!unlimited && remaining <= 0)}
          onClick={run}
        >
          {phase === "reading" && "Reading…"}
          {phase === "detecting" && "Detecting domain…"}
          {phase === "translating" && `Translating… ${progress}%`}
          {(phase === "idle" || phase === "done" || phase === "error") && "Translate document"}
        </button>
        {(phase === "done" || phase === "error") && (
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Start over
          </button>
        )}
      </div>

      {/* Progress bar */}
      {phase === "translating" && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[color:var(--brand)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Result */}
      {phase === "done" && download && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
          <p className="font-medium text-green-700 dark:text-green-300">
            Translation ready — layout preserved.
          </p>
          <a
            href={download.url}
            download={download.filename}
            className="btn btn-primary mt-3 inline-block"
          >
            Download {download.filename}
          </a>
          <p className="mt-2 text-xs muted">
            Machine translation — review before professional use.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

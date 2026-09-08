"use client";

import { useRef, useState } from "react";
import {
  loadDocument,
  isSupportedDoc,
  pdfSupportsLanguage,
  type LoadedDoc,
} from "@/lib/docs";
import { LANGUAGES, isLowResource } from "@/lib/docs/languages";
import { DOMAINS } from "@/lib/ai/glossaries";
import { startDocJob, finishDocJob } from "@/lib/actions/doc";

type Phase =
  | "idle"
  | "reading"
  | "ocr"
  | "detecting"
  | "translating"
  | "review"
  | "building"
  | "done"
  | "error";

// How many paragraph segments to send per request — keeps each serverless call
// well under the function timeout.
const CHUNK = 40;

interface DownloadReady {
  url: string;
  filename: string;
  ocr: boolean;
}

interface ReviewState {
  originals: string[];
  translations: string[];
  ocr: boolean;
  outputExt?: string;
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
  const [ocrLabel, setOcrLabel] = useState("");
  const [review, setReview] = useState<ReviewState | null>(null);
  const buildRef = useRef<((t: string[]) => Promise<Blob>) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy =
    phase === "reading" ||
    phase === "ocr" ||
    phase === "detecting" ||
    phase === "translating" ||
    phase === "building";
  const remaining = Math.max(0, allowance - used);
  // Inputs are locked once processing starts and while reviewing/finished, so
  // the target language can't drift out of sync with an already-translated doc.
  const locked = busy || phase === "review" || phase === "done";

  function reset() {
    setPhase("idle");
    setProgress(0);
    setDetected(null);
    setError(null);
    setReview(null);
    buildRef.current = null;
    if (download) URL.revokeObjectURL(download.url);
    setDownload(null);
  }

  function editTranslation(i: number, value: string) {
    setReview((r) =>
      r ? { ...r, translations: r.translations.map((t, idx) => (idx === i ? value : t)) } : r
    );
  }

  const isPdfFile = Boolean(file && file.name.toLowerCase().endsWith(".pdf"));
  // Informational only: digital PDFs keep the PDF and use standard fonts, so
  // non-Western scripts aren't supported for *digital* PDFs. Scanned PDFs are
  // rebuilt as .docx and support every language, so this is a soft hint, not a
  // hard block (accurate enforcement happens after we know the PDF's type).
  const pdfLangHint = isPdfFile && !pdfSupportsLanguage(targetLang);

  function onPick(f: File | null) {
    reset();
    if (f && !isSupportedDoc(f.name)) {
      setError("Unsupported file. Supported: Word/PowerPoint/Excel, PDF, and images (.png/.jpg).");
      setFile(null);
      return;
    }
    setFile(f);
  }

  function outName(original: string, lang: string, outputExt?: string): string {
    const dot = original.lastIndexOf(".");
    const base = dot === -1 ? original : original.slice(0, dot);
    const ext = outputExt ? `.${outputExt}` : dot === -1 ? "" : original.slice(dot);
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
      // 1. Parse the document in the browser (OCR runs here for scans/images).
      setPhase("reading");
      let doc: LoadedDoc;
      try {
        doc = await loadDocument(file, {
          sourceLang,
          onOcrProgress: (frac, label) => {
            setPhase("ocr");
            setProgress(Math.round(frac * 100));
            setOcrLabel(label);
          },
        });
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Couldn't read that file.");
      }
      if (doc.segments.length === 0) {
        throw new Error("No translatable text was found in this document.");
      }
      // Accurate enforcement now that we know the type: digital PDFs (kept as
      // PDF, standard fonts) only support Western-European target scripts.
      if (doc.kind === "pdf" && !doc.ocr && !pdfSupportsLanguage(targetLang)) {
        throw new Error(
          `Digital PDFs can't yet be translated into ${targetLang} (its script needs an embedded font). Pick a Western-European target, or convert the PDF to Word first.`
        );
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
      setProgress(0);
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

      // 5. Hand off to the review step: the member can edit any segment before
      //    the file is rebuilt. Translation itself succeeded, so mark complete.
      buildRef.current = doc.build;
      setReview({
        originals: all,
        translations: output,
        ocr: Boolean(doc.ocr),
        outputExt: doc.outputExt,
      });
      setPhase("review");
      await finishDocJob(jobId, "complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setPhase("error");
      if (jobId) await finishDocJob(jobId, "error").catch(() => {});
    }
  }

  async function buildAndDownload() {
    if (!review || !buildRef.current || !file) return;
    setPhase("building");
    setError(null);
    try {
      const blob = await buildRef.current(review.translations);
      const url = URL.createObjectURL(blob);
      setDownload({
        url,
        filename: outName(file.name, targetLang, review.outputExt),
        ocr: review.ocr,
      });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the file. Please try again.");
      setPhase("review");
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
          accept=".docx,.pptx,.xlsx,.pdf,.png,.jpg,.jpeg,.webp"
          disabled={locked}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--brand)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {file && (
          <p className="mt-2 text-sm muted">
            Selected: <span className="font-medium">{file.name}</span>
          </p>
        )}
        <p className="mt-2 text-xs muted">
          Word (.docx), PowerPoint (.pptx), Excel (.xlsx), and digital PDFs keep
          their layout. Scanned PDFs and images (.png/.jpg) are read with OCR and
          rebuilt as an editable Word file — the first OCR run downloads the
          engine, and OCR output should always be reviewed.
        </p>
      </div>

      {/* Options */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Translate into</label>
          <select
            className="input"
            value={targetLang}
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
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

      {pdfLangHint && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          If this is a <strong>digital</strong> PDF, output into{" "}
          <strong>{targetLang}</strong> isn&apos;t supported yet (its script needs
          an embedded font). Scanned PDFs are fine — they&apos;re rebuilt as Word,
          which supports every language.
        </div>
      )}

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
      {phase !== "review" && phase !== "building" && phase !== "done" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!file || busy || (!unlimited && remaining <= 0)}
            onClick={run}
          >
            {phase === "reading" && "Reading…"}
            {phase === "ocr" && `Reading text (OCR)… ${progress}%`}
            {phase === "detecting" && "Detecting domain…"}
            {phase === "translating" && `Translating… ${progress}%`}
            {(phase === "idle" || phase === "error") && "Translate document"}
          </button>
          {phase === "error" && (
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Start over
            </button>
          )}
        </div>
      )}

      {/* Progress bar */}
      {(phase === "translating" || phase === "ocr") && (
        <div className="flex flex-col gap-1">
          {phase === "ocr" && ocrLabel && (
            <span className="text-xs muted capitalize">{ocrLabel}</span>
          )}
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[color:var(--brand)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Review & edit */}
      {(phase === "review" || phase === "building") && review && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border divider bg-[color:var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Review the translation</p>
              <p className="text-sm muted">
                {review.translations.length} segment
                {review.translations.length === 1 ? "" : "s"} · edit anything
                below, then build your file.
                {review.ocr && " Rebuilt from a scan (OCR) — check for misreads."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={phase === "building"}
                onClick={reset}
              >
                Start over
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={phase === "building"}
                onClick={buildAndDownload}
              >
                {phase === "building" ? "Building…" : "Build & download"}
              </button>
            </div>
          </div>

          <div className="flex max-h-[60vh] flex-col divide-y divide-[color:var(--border)] overflow-y-auto rounded-lg border divider">
            {review.originals.map((orig, i) => (
              <div key={i} className="grid gap-2 p-3 sm:grid-cols-2">
                <p className="whitespace-pre-wrap text-sm muted">{orig}</p>
                <textarea
                  className="input min-h-[3rem] resize-y text-sm"
                  value={review.translations[i]}
                  disabled={phase === "building"}
                  onChange={(e) => editTranslation(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {phase === "done" && download && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
          <p className="font-medium text-green-700 dark:text-green-300">
            {download.ocr
              ? "Translation ready — rebuilt as an editable Word file."
              : "Translation ready — layout preserved."}
          </p>
          <a
            href={download.url}
            download={download.filename}
            className="btn btn-primary mt-3 inline-block"
          >
            Download {download.filename}
          </a>
          <p className="mt-2 text-xs muted">
            {download.ocr
              ? "Read from a scan with OCR and machine-translated — check the text and layout before use."
              : "Machine translation — review before professional use."}
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

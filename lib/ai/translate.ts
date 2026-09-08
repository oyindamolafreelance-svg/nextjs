import { DOMAINS, domainInstruction, type DomainId } from "./glossaries";

// Shared translation engine for the document translator. Runs server-side
// (route handlers) and reuses the same free-tier providers as job auto-fill:
//   * GEMINI_API_KEY    → Google Gemini (free tier; preferred)
//   * ANTHROPIC_API_KEY → Anthropic Claude
// Unlike the job extractor there is no offline fallback — machine translation
// genuinely needs a model — so if no provider is configured/reachable we throw
// a clear, user-facing error instead of returning garbage.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export class TranslateError extends Error {}

export interface TranslateOptions {
  sourceLang: string; // "auto" or a language name
  targetLang: string; // language name, e.g. "French"
  domain?: DomainId | string;
}

// Batch sizing keeps each request small enough for the free tier's per-request
// limits and easy to retry on failure.
const MAX_SEGMENTS_PER_BATCH = 40;
const MAX_CHARS_PER_BATCH = 4000;

function hasProvider(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export function providerConfigured(): boolean {
  return hasProvider();
}

// ---------------------------------------------------------------------------
// Domain + source-language detection from a text sample.
// ---------------------------------------------------------------------------
export interface Detection {
  domain: DomainId;
  domainLabel: string;
  sourceLanguage: string; // best-effort language name, or "unknown"
}

const DETECT_SYSTEM = `You classify a document excerpt. Return ONLY a JSON object with exactly these keys:
- "domain": one of ${DOMAINS.map((d) => `"${d.id}"`).join(", ")}
- "sourceLanguage": the language the excerpt is written in, as an English language name (e.g. "Spanish"), or "unknown"
Pick the single best domain. No commentary, no code fences.`;

export async function detectDomainAndLanguage(sample: string): Promise<Detection> {
  const text = sample.trim().slice(0, 4000);
  if (!text || !hasProvider()) {
    return { domain: "general", domainLabel: "General", sourceLanguage: "unknown" };
  }
  try {
    const raw = process.env.GEMINI_API_KEY
      ? await geminiJson(DETECT_SYSTEM, `Excerpt:\n\n${text}`)
      : await anthropicJson(DETECT_SYSTEM, `Excerpt:\n\n${text}`);
    const obj = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    const id = String(obj.domain ?? "general");
    const def = DOMAINS.find((d) => d.id === id) ?? DOMAINS[0];
    const lang = typeof obj.sourceLanguage === "string" && obj.sourceLanguage.trim()
      ? obj.sourceLanguage.trim()
      : "unknown";
    return { domain: def.id, domainLabel: def.label, sourceLanguage: lang };
  } catch {
    return { domain: "general", domainLabel: "General", sourceLanguage: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Segment translation. Input order/length is always preserved: translations[i]
// corresponds to segments[i]. Empty/whitespace/placeholder-only segments are
// returned unchanged without spending a call.
// ---------------------------------------------------------------------------
export async function translateSegments(
  segments: string[],
  opts: TranslateOptions
): Promise<string[]> {
  if (!hasProvider()) {
    throw new TranslateError(
      "Translation isn't configured on the server yet (no AI key). Add GEMINI_API_KEY to enable it."
    );
  }

  const out = new Array<string>(segments.length);
  // Indexes that actually need translating (skip blanks & pure placeholders).
  const todo: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!s || !s.trim() || /^[\s\d\p{P}\p{S}]+$/u.test(s)) {
      out[i] = s;
    } else {
      todo.push(i);
    }
  }

  // Build batches bounded by count and characters.
  let batch: number[] = [];
  let batchChars = 0;
  const flushes: Promise<void>[] = [];
  const runBatch = async (idxs: number[]) => {
    if (idxs.length === 0) return;
    const translated = await translateBatch(
      idxs.map((i) => segments[i]),
      opts
    );
    idxs.forEach((i, k) => {
      out[i] = translated[k];
    });
  };

  for (const i of todo) {
    const len = segments[i].length;
    if (
      batch.length >= MAX_SEGMENTS_PER_BATCH ||
      (batch.length > 0 && batchChars + len > MAX_CHARS_PER_BATCH)
    ) {
      flushes.push(runBatch(batch));
      batch = [];
      batchChars = 0;
    }
    batch.push(i);
    batchChars += len;
  }
  flushes.push(runBatch(batch));

  // Batches were started above; wait for them all. (A request only ever holds
  // a chunk of ~40 segments, so this is 1–2 batches — friendly to the free
  // tier without extra pacing.)
  await Promise.all(flushes);
  // Any still-undefined slot (shouldn't happen) falls back to the original.
  for (let i = 0; i < segments.length; i++) {
    if (out[i] === undefined) out[i] = segments[i];
  }
  return out;
}

function buildTranslateSystem(opts: TranslateOptions): string {
  const src =
    !opts.sourceLang || opts.sourceLang === "auto"
      ? "the document's source language (auto-detect it)"
      : opts.sourceLang;
  return [
    `You are a professional human translator. Translate from ${src} into ${opts.targetLang}.`,
    domainInstruction(opts.domain),
    "Rules:",
    "- You receive a JSON array of text segments. Return ONLY a JSON array of the same length, in the same order, each element the translation of the corresponding input.",
    "- Preserve meaning and tone; produce natural, idiomatic target-language text, not a word-for-word gloss.",
    "- Keep unchanged: numbers, dates, currency, proper names, email addresses, URLs, code, HTML/XML tags, and placeholders such as {name}, %s, %1$s, [[x]].",
    "- Never merge or split segments. If a segment should not change (e.g. a name or code), return it as-is.",
    "- No commentary, no code fences — only the JSON array.",
  ].join("\n");
}

async function translateBatch(
  inputs: string[],
  opts: TranslateOptions
): Promise<string[]> {
  const system = buildTranslateSystem(opts);
  const user = `Translate these ${inputs.length} segments:\n${JSON.stringify(inputs)}`;

  let raw: string;
  try {
    raw = process.env.GEMINI_API_KEY
      ? await geminiJson(system, user)
      : await anthropicJson(system, user);
  } catch (err) {
    // If the whole batch fails and it's splittable, split once and retry each
    // half — a smaller request often succeeds on a busy free tier.
    if (inputs.length > 1) {
      const mid = Math.floor(inputs.length / 2);
      const [a, b] = await Promise.all([
        translateBatch(inputs.slice(0, mid), opts),
        translateBatch(inputs.slice(mid), opts),
      ]);
      return [...a, ...b];
    }
    throw err instanceof TranslateError
      ? err
      : new TranslateError("Translation failed. Please try again.");
  }

  let arr: unknown;
  try {
    arr = JSON.parse(extractJson(raw));
  } catch {
    arr = null;
  }
  if (Array.isArray(arr) && arr.length === inputs.length) {
    return arr.map((v, i) => (typeof v === "string" ? v : inputs[i]));
  }
  // Length mismatch: split and retry so we never misalign segments.
  if (inputs.length > 1) {
    const mid = Math.floor(inputs.length / 2);
    const [a, b] = await Promise.all([
      translateBatch(inputs.slice(0, mid), opts),
      translateBatch(inputs.slice(mid), opts),
    ]);
    return [...a, ...b];
  }
  // Single segment that wouldn't parse — return original untranslated rather
  // than dropping content.
  return inputs;
}

// ---------------------------------------------------------------------------
// Provider calls (JSON-mode). Both return the raw text body.
// ---------------------------------------------------------------------------
async function geminiJson(system: string, user: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new TranslateError("Couldn't reach the translation service. Please try again.");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[translate] Gemini error", { status: res.status, body: detail.slice(0, 400) });
    if (res.status === 429) {
      throw new TranslateError("The free translation tier is rate-limited right now. Please retry in a moment.");
    }
    throw new TranslateError(`Translation service error (${res.status}). Please try again.`);
  }
  const json = await res.json().catch(() => null);
  const parts = json?.candidates?.[0]?.content?.parts;
  const out = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text ?? "").join("")
    : "";
  if (!out) throw new TranslateError("The translation service returned no text. Please try again.");
  return out;
}

async function anthropicJson(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY as string;
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch {
    throw new TranslateError("Couldn't reach the translation service. Please try again.");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[translate] Anthropic error", { status: res.status, body: detail.slice(0, 400) });
    if (res.status === 429) {
      throw new TranslateError("The translation service is rate-limited right now. Please retry in a moment.");
    }
    throw new TranslateError(`Translation service error (${res.status}). Please try again.`);
  }
  const json = await res.json().catch(() => null);
  const content: string | undefined = json?.content?.find(
    (b: { type: string }) => b.type === "text"
  )?.text;
  if (!content) throw new TranslateError("The translation service returned an empty response.");
  return content;
}

// Strip stray code fences and grab the outermost JSON value.
function extractJson(raw: string): string {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const firstArr = cleaned.indexOf("[");
  const firstObj = cleaned.indexOf("{");
  const start =
    firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstArr, firstObj);
  const lastArr = cleaned.lastIndexOf("]");
  const lastObj = cleaned.lastIndexOf("}");
  const end = Math.max(lastArr, lastObj);
  if (start === -1 || end === -1 || end < start) return cleaned;
  return cleaned.slice(start, end + 1);
}

import type { ParsedJobFields } from "@/lib/types";
import { extractJobFields } from "./extract-job";

// The admin auto-fill works with EITHER provider — whichever key is set:
//   * GEMINI_API_KEY  → Google Gemini (has a free tier; preferred if present)
//   * ANTHROPIC_API_KEY → Anthropic Claude
// Models are overridable via GEMINI_MODEL / ANTHROPIC_MODEL.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const FIELD_KEYS: (keyof ParsedJobFields)[] = [
  "title",
  "language_pair",
  "domain",
  "work_type",
  "experience_required",
  "apply_contact",
  "application_instructions",
];

const SYSTEM_PROMPT = `You extract structured data from raw translation/localization job postings that a human copied from sites like ProZ, LinkedIn, or agency career pages.

Return ONLY a single JSON object — no markdown, no code fences, no commentary — with exactly these string keys:
- "title": the job/role title
- "language_pair": e.g. "English → French", or "Multiple pairs accepted" if several are listed
- "domain": specialization such as legal, medical, technical, marketing, literary, gaming, general
- "work_type": e.g. translation, localization, MTPE, proofreading, subtitling, transcreation
- "experience_required": e.g. "3+ years", "entry-level ok", "native speaker required" (empty string if unspecified)
- "apply_contact": the email address and/or URL to apply
- "application_instructions": required documents, subject-line format, deadline, rate info if listed

Rules:
- Every key must be present. If a value is not stated, use an empty string "".
- Do not invent contact details or requirements that are not in the text.
- Keep values concise and plain-text (no markdown).`;

export class ParseJobError extends Error {}

// Turns pasted job text into structured fields using whichever AI provider is
// configured. Throws ParseJobError with a user-safe message on any failure.
export async function parseJobText(rawText: string): Promise<ParsedJobFields> {
  const text = rawText.trim();
  if (!text) {
    throw new ParseJobError("Paste the job posting text first.");
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // With an AI key set, use the model (best quality). With none, fall back to
  // the built-in key-free extractor — no network, no billing, always available.
  if (geminiKey) return normalize(await callGemini(geminiKey, text));
  if (anthropicKey) return normalize(await callAnthropic(anthropicKey, text));
  return extractJobFields(text);
}

// ---------------------------------------------------------------------------
// Google Gemini (generativelanguage API). Free tier available.
// ---------------------------------------------------------------------------
async function callGemini(apiKey: string, text: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [{ text: `Extract the fields from this job posting:\n\n${text}` }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new ParseJobError("Couldn't reach the AI service. Please try again.");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let reason = "";
    try {
      reason = JSON.parse(detail)?.error?.message ?? "";
    } catch {
      reason = detail.slice(0, 300);
    }
    console.error("[parse-job] Gemini error", {
      status: res.status,
      model: GEMINI_MODEL,
      body: detail.slice(0, 500),
    });
    throw new ParseJobError(
      `AI service error (${res.status}) [gemini: ${GEMINI_MODEL}]: ${
        reason || "no error detail returned"
      }. Please try again.`
    );
  }

  const json = await res.json().catch(() => null);
  const parts = json?.candidates?.[0]?.content?.parts;
  const out = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text ?? "").join("")
    : "";

  if (!out) {
    const finishReason = json?.candidates?.[0]?.finishReason;
    throw new ParseJobError(
      `The AI returned no text${finishReason ? ` (${finishReason})` : ""}. Please try again.`
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Anthropic Claude (Messages API).
// ---------------------------------------------------------------------------
async function callAnthropic(apiKey: string, text: string): Promise<string> {
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Extract the fields from this job posting:\n\n${text}`,
          },
        ],
      }),
    });
  } catch {
    throw new ParseJobError("Couldn't reach the AI service. Please try again.");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let reason = "";
    try {
      reason = JSON.parse(detail)?.error?.message ?? "";
    } catch {
      reason = detail.slice(0, 300);
    }
    console.error("[parse-job] Anthropic error", {
      status: res.status,
      model: ANTHROPIC_MODEL,
      body: detail.slice(0, 500),
    });
    throw new ParseJobError(
      `AI service error (${res.status}) [claude: ${ANTHROPIC_MODEL}]: ${
        reason || "no error detail returned"
      }. Please try again.`
    );
  }

  const json = await res.json().catch(() => null);
  const content: string | undefined = json?.content?.find(
    (b: { type: string }) => b.type === "text"
  )?.text;

  if (!content) {
    throw new ParseJobError("The AI returned an empty response. Please try again.");
  }
  return content;
}

// The model is instructed to return bare JSON, but strip stray code fences and
// grab the outermost object just in case, then coerce to the exact shape.
function normalize(raw: string): ParsedJobFields {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new ParseJobError("Couldn't parse the AI response. Please try again.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new ParseJobError("Couldn't parse the AI response. Please try again.");
  }

  const result = {} as ParsedJobFields;
  for (const key of FIELD_KEYS) {
    const value = parsed[key];
    result[key] = typeof value === "string" ? value.trim() : "";
  }
  return result;
}

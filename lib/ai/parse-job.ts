import type { ParsedJobFields } from "@/lib/types";

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

// Calls the Anthropic Messages API to turn pasted job text into structured
// fields. Throws ParseJobError with a user-safe message on any failure.
export async function parseJobText(rawText: string): Promise<ParsedJobFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ParseJobError(
      "AI auto-fill isn't configured. Set ANTHROPIC_API_KEY, or fill the fields manually."
    );
  }

  const text = rawText.trim();
  if (!text) {
    throw new ParseJobError("Paste the job posting text first.");
  }

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
    // Surface the API's own reason (e.g. an invalid model or auth problem);
    // this is an admin-only screen, so the extra detail is safe and useful.
    const detail = await res.text().catch(() => "");
    let reason = "";
    try {
      reason = JSON.parse(detail)?.error?.message ?? "";
    } catch {
      reason = detail.slice(0, 200);
    }
    throw new ParseJobError(
      `AI service error (${res.status})${reason ? `: ${reason}` : ""}. Please try again.`
    );
  }

  const json = await res.json().catch(() => null);
  const content: string | undefined = json?.content?.find(
    (b: { type: string }) => b.type === "text"
  )?.text;

  if (!content) {
    throw new ParseJobError("The AI returned an empty response. Please try again.");
  }

  return normalize(content);
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

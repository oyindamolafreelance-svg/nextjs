import type { Job } from "@/lib/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export interface DraftResult {
  text: string;
  source: "ai" | "template";
}

function buildPrompt(job: Job, about: string): string {
  return [
    "Write a concise, professional job application / cover message a translator can send for the job below.",
    "Requirements: 120–180 words, ready to send, warm but professional, plain text (no markdown).",
    "Explicitly mention fit for the language pair and domain. End with availability and a thank-you.",
    "Do NOT invent specific credentials that aren't provided; if applicant details are missing, keep phrasing general and leave a [Your name] sign-off.",
    "",
    `Job title: ${job.title}`,
    `Language pair: ${job.language_pair}`,
    `Domain: ${job.domain}`,
    `Work type: ${job.work_type}`,
    job.experience_required ? `Experience required: ${job.experience_required}` : "",
    job.description ? `Job details: ${job.description.slice(0, 1500)}` : "",
    "",
    about.trim()
      ? `About the applicant (use this to personalize): ${about.trim().slice(0, 800)}`
      : "The applicant is a professional translator; keep personal claims general.",
  ]
    .filter(Boolean)
    .join("\n");
}

function template(job: Job, about: string): string {
  const intro = about.trim()
    ? about.trim()
    : `As a professional translator working in ${job.language_pair}`;
  return `Dear Hiring Manager,

I'm writing to apply for the "${job.title}" role (${job.language_pair}, ${job.domain} ${job.work_type}). ${intro}, I'm confident I can deliver accurate, natural work that fits this brief.

I pay close attention to terminology and style, respect deadlines, and am comfortable with standard CAT tools. I'd be glad to share my CV, relevant samples, and rates, and I'm happy to complete a short test if required.

I'm available to start promptly. Thank you for considering my application — I look forward to hearing from you.

Best regards,
[Your name]`;
}

export async function generateApplication(job: Job, about = ""): Promise<DraftResult> {
  const prompt = buildPrompt(job, about);
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  try {
    if (geminiKey) {
      const text = await callGemini(geminiKey, prompt);
      if (text) return { text, source: "ai" };
    } else if (anthropicKey) {
      const text = await callAnthropic(anthropicKey, prompt);
      if (text) return { text, source: "ai" };
    }
  } catch {
    // fall through to template
  }

  return { text: template(job, about), source: "template" };
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text ?? "").join("").trim()
    : "";
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = await res.json();
  return (
    json?.content?.find((b: { type: string }) => b.type === "text")?.text?.trim() ?? ""
  );
}

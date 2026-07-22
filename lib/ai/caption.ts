export interface CaptionBrandContext {
  platform: "TIKTOK" | "FACEBOOK";
  niche: string;
  brandTone: string | null;
  brandHashtags: string[];
  topic?: string;
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export async function generateCaption(context: CaptionBrandContext): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return templateCaption(context);
  }

  const hashtagLine = context.brandHashtags.length
    ? `Always weave in these brand hashtags: ${context.brandHashtags.join(" ")}`
    : "Add 3-5 relevant hashtags for the niche.";

  const prompt = [
    `Write a single ${context.platform === "TIKTOK" ? "TikTok" : "Facebook"} post caption.`,
    `Niche: ${context.niche}`,
    context.brandTone ? `Brand voice/tone: ${context.brandTone}` : null,
    context.topic ? `Topic for this specific post: ${context.topic}` : `Pick an engaging angle relevant to the niche.`,
    hashtagLine,
    `Keep it short (1-3 sentences plus hashtags), no markdown, no surrounding quotes.`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Caption generation failed (${res.status}): ${errBody}`);
  }

  const json = await res.json();
  const text = json?.content?.find((block: { type: string }) => block.type === "text")?.text;

  if (!text) {
    throw new Error("Caption generation returned no text.");
  }

  return text.trim();
}

function templateCaption(context: CaptionBrandContext): string {
  const hashtags = context.brandHashtags.length
    ? context.brandHashtags.join(" ")
    : `#${context.niche.replace(/\s+/g, "")}`;
  const tone = context.brandTone ? ` (${context.brandTone} vibes)` : "";
  return `New drop for our ${context.niche} community${tone}! ${hashtags}`;
}

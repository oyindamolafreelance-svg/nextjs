// Keyless translation fallback — NO API key required.
//
// When no AI provider is configured (or every configured one is overloaded),
// we fall back to free public machine-translation endpoints so the tool still
// works. Quality is solid (this is the same engine family as the Google
// Translate website) but there's no domain-glossary steering like the LLM path.
//
// Two engines, tried in order per segment:
//   1. Google's public "gtx" endpoint (no key) — best quality.
//   2. MyMemory (no key, generous anonymous quota) — reliable backup.

const LANG_CODE: Record<string, string> = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Portuguese: "pt",
  Italian: "it",
  Dutch: "nl",
  Russian: "ru",
  Arabic: "ar",
  "Chinese (Simplified)": "zh-CN",
  "Chinese (Traditional)": "zh-TW",
  Japanese: "ja",
  Korean: "ko",
  Hindi: "hi",
  Turkish: "tr",
  Polish: "pl",
  Ukrainian: "uk",
  Vietnamese: "vi",
  Indonesian: "id",
  Thai: "th",
  Hebrew: "he",
  Greek: "el",
  Swedish: "sv",
  Romanian: "ro",
  Czech: "cs",
  Yoruba: "yo",
  Igbo: "ig",
  Hausa: "ha",
  Swahili: "sw",
  Amharic: "am",
  Zulu: "zu",
  Mongolian: "mn",
  Khmer: "km",
  Lao: "lo",
  Pashto: "ps",
};

function code(name: string | undefined): string {
  if (!name || name === "auto") return "auto";
  return LANG_CODE[name] ?? "auto";
}

async function googleGtx(text: string, sl: string, tl: string): Promise<string | null> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
    `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    // Shape: [[["translated","orig",...], ...], ...]
    const rows = Array.isArray(data) ? (data as unknown[])[0] : null;
    if (!Array.isArray(rows)) return null;
    return rows
      .map((r) => (Array.isArray(r) ? (typeof r[0] === "string" ? r[0] : "") : ""))
      .join("");
  } catch {
    return null;
  }
}

async function myMemory(text: string, sl: string, tl: string): Promise<string | null> {
  // MyMemory needs a concrete source language; default to English if unknown.
  const from = sl === "auto" ? "en" : sl;
  const url =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(tl)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    const t = data?.responseData?.translatedText;
    return typeof t === "string" && t ? t : null;
  } catch {
    return null;
  }
}

export function keylessSupportsTarget(name: string): boolean {
  return Boolean(LANG_CODE[name]);
}

// Translate each segment with the keyless engines. Order/length preserved;
// blanks pass through; a segment that both engines fail on is returned as-is.
export async function keylessTranslateSegments(
  segments: string[],
  sourceLang: string | undefined,
  targetLang: string
): Promise<string[]> {
  const sl = code(sourceLang);
  const tl = code(targetLang);
  if (tl === "auto") {
    // No mapping for the target — can't translate keyless.
    throw new Error(`Keyless translation doesn't support ${targetLang} yet.`);
  }

  const out = new Array<string>(segments.length);
  let next = 0;
  const CONCURRENCY = 4;

  async function worker() {
    while (next < segments.length) {
      const i = next++;
      const s = segments[i];
      if (!s || !s.trim()) {
        out[i] = s;
        continue;
      }
      let r = await googleGtx(s, sl, tl);
      if (r == null) r = await myMemory(s, sl, tl);
      out[i] = r ?? s;
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

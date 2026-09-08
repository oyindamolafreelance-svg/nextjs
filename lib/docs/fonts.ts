// Unicode font loading for PDF output, so digital PDFs can be translated into
// scripts the PDF standard fonts (WinAnsi) can't render — Chinese, Japanese,
// Korean, Cyrillic, Greek, Arabic, and more.
//
// PDF standard fonts only cover Western-European text. For anything else we
// embed a Noto font (fetched in the browser from a CDN, then subset into the
// PDF by pdf-lib + fontkit). The exact CDN URL is the thing most likely to need
// tweaking in a given deployment, so it's overridable via NEXT_PUBLIC_FONT_BASE.

// Languages the PDF standard font (Helvetica / WinAnsi) already covers — no
// embedded font needed.
const WESTERN = new Set([
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Dutch",
  "Swedish",
  "Danish",
  "Norwegian",
  "Finnish",
  "Icelandic",
  "Indonesian",
]);

// Language → Noto font file (from the @expo-google-fonts packages, which ship
// real .ttf files usable by fontkit). Each entry lists one or more CDN URLs to
// try in order.
interface FontSpec {
  key: string;
  files: string[]; // "package/File.ttf" relative paths
}

const FONT_SPECS: Record<string, FontSpec> = {
  "Chinese (Simplified)": { key: "sc", files: ["noto-sans-sc/NotoSansSC_400Regular.ttf"] },
  "Chinese (Traditional)": { key: "tc", files: ["noto-sans-tc/NotoSansTC_400Regular.ttf"] },
  Japanese: { key: "jp", files: ["noto-sans-jp/NotoSansJP_400Regular.ttf"] },
  Korean: { key: "kr", files: ["noto-sans-kr/NotoSansKR_400Regular.ttf"] },
  Arabic: { key: "arabic", files: ["noto-sans-arabic/NotoSansArabic_400Regular.ttf"] },
  Hebrew: { key: "hebrew", files: ["noto-sans-hebrew/NotoSansHebrew_400Regular.ttf"] },
  Hindi: { key: "deva", files: ["noto-sans-devanagari/NotoSansDevanagari_400Regular.ttf"] },
  Thai: { key: "thai", files: ["noto-sans-thai/NotoSansThai_400Regular.ttf"] },
  Amharic: { key: "ethiopic", files: ["noto-sans-ethiopic/NotoSansEthiopic_400Regular.ttf"] },
};

// Languages that use Latin-extended / Cyrillic / Greek / Vietnamese — all
// covered by the base Noto Sans family.
const NOTO_SANS: FontSpec = { key: "sans", files: ["noto-sans/NotoSans_400Regular.ttf"] };
const NOTO_SANS_LANGS = new Set([
  "Russian",
  "Ukrainian",
  "Greek",
  "Turkish",
  "Polish",
  "Romanian",
  "Czech",
  "Vietnamese",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Swahili",
  "Zulu",
]);

// CDN bases tried in order (npm packages). Override the primary with
// NEXT_PUBLIC_FONT_BASE if needed.
function cdnBases(): string[] {
  const override = process.env.NEXT_PUBLIC_FONT_BASE;
  const bases = [
    "https://cdn.jsdelivr.net/npm/@expo-google-fonts/",
    "https://unpkg.com/@expo-google-fonts/",
  ];
  return override ? [override, ...bases] : bases;
}

function specFor(language: string): FontSpec | null {
  if (WESTERN.has(language)) return null; // standard font is fine
  if (FONT_SPECS[language]) return FONT_SPECS[language];
  if (NOTO_SANS_LANGS.has(language)) return NOTO_SANS;
  return null;
}

// True when we can render this language in a PDF (either a standard font or an
// embeddable Noto font is available).
export function pdfLanguageSupported(language: string): boolean {
  return WESTERN.has(language) || specFor(language) !== null;
}

// Whether this language needs an embedded Unicode font (vs. the standard font).
export function needsUnicodeFont(language: string): boolean {
  return specFor(language) !== null;
}

const cache = new Map<string, ArrayBuffer>();

// Fetch (and cache) the font bytes for a language. Returns null when the
// standard font should be used. Throws if an embed font is required but every
// CDN URL fails.
export async function loadFontBytes(language: string): Promise<ArrayBuffer | null> {
  const spec = specFor(language);
  if (!spec) return null;
  if (cache.has(spec.key)) return cache.get(spec.key)!;

  const urls: string[] = [];
  for (const base of cdnBases()) {
    for (const file of spec.files) urls.push(base + file);
  }

  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) {
        lastErr = new Error(`Suspiciously small font at ${url}`);
        continue;
      }
      cache.set(spec.key, buf);
      return buf;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Couldn't load the ${language} font for PDF output. ${
      lastErr instanceof Error ? lastErr.message : ""
    }`.trim()
  );
}

import type { ParsedJobFields } from "@/lib/types";

// Key-free, offline extractor. Pulls structured fields out of pasted job text
// using pattern matching — no AI, no API key, no network. It's deliberately
// conservative: it fills a field only when it finds a confident match and
// leaves the rest blank for the admin to complete. Since the admin reviews
// before posting, partial pre-fill is a net win.

const LANGUAGES = [
  "English", "French", "Spanish", "German", "Italian", "Portuguese", "Dutch",
  "Polish", "Russian", "Ukrainian", "Arabic", "Chinese", "Mandarin",
  "Cantonese", "Japanese", "Korean", "Hindi", "Turkish", "Swedish",
  "Norwegian", "Danish", "Finnish", "Greek", "Czech", "Hungarian", "Romanian",
  "Bulgarian", "Croatian", "Serbian", "Slovak", "Slovenian", "Hebrew", "Thai",
  "Vietnamese", "Indonesian", "Malay", "Tagalog", "Filipino", "Farsi",
  "Persian", "Urdu", "Bengali", "Catalan", "Basque", "Galician", "Welsh",
  "Irish", "Icelandic", "Estonian", "Latvian", "Lithuanian", "Afrikaans",
  "Swahili", "Amharic", "Somali", "Yoruba", "Igbo", "Hausa", "Zulu",
];

const LANG_CODES: Record<string, string> = {
  EN: "English", FR: "French", ES: "Spanish", DE: "German", IT: "Italian",
  PT: "Portuguese", NL: "Dutch", PL: "Polish", RU: "Russian", UK: "Ukrainian",
  AR: "Arabic", ZH: "Chinese", JA: "Japanese", JP: "Japanese", KO: "Korean",
  HI: "Hindi", TR: "Turkish", SV: "Swedish", NO: "Norwegian", DA: "Danish",
  FI: "Finnish", EL: "Greek", CS: "Czech", HU: "Hungarian", RO: "Romanian",
};

const SEP = "(?:→|-?->|—>|>>?|➜|to|into|›|»|/|\\\\|-|–)";

const DOMAIN_RULES: [RegExp, string][] = [
  [/\b(legal|law|contract|litigation|patent)\b/i, "legal"],
  [/\b(medical|clinical|pharma\w*|healthcare|health|life sciences)\b/i, "medical"],
  [/\b(technical|engineering|manual|machinery|automotive|manufactur\w*)\b/i, "technical"],
  [/\b(marketing|advertis\w*|brand\w*|transcreation|copywrit\w*)\b/i, "marketing"],
  [/\b(literary|fiction|novel|book|poetry|publishing)\b/i, "literary"],
  [/\b(gaming|video ?game|game ?localization)\b/i, "gaming"],
  [/\b(financial|finance|banking|accounting|economic)\b/i, "financial"],
  [/\b(software|\bIT\b|app|UI|UX|website|web|e-?commerce)\b/i, "software/IT"],
  [/\b(tourism|travel|hospitality)\b/i, "tourism"],
  [/\b(subtitl\w*|audiovisual|dubbing|media)\b/i, "audiovisual"],
];

const WORKTYPE_RULES: [RegExp, string][] = [
  [/\b(MTPE|post-?editing|machine translation post)\b/i, "MTPE"],
  [/\b(subtitl\w*|captioning)\b/i, "subtitling"],
  [/\b(transcreation|transcreat\w*)\b/i, "transcreation"],
  [/\b(proofread\w*|revision|revis\w*|editing|QA|quality assurance)\b/i, "proofreading"],
  [/\b(localis\w*|localiz\w*)\b/i, "localization"],
  [/\b(interpret\w*)\b/i, "interpreting"],
  [/\b(translat\w*)\b/i, "translation"],
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /https?:\/\/[^\s<>"')]+/i;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function firstMatch(rules: [RegExp, string][], text: string): string {
  for (const [re, label] of rules) {
    if (re.test(text)) return label;
  }
  return "";
}

function detectLanguagePair(text: string): string {
  const langAlt = LANGUAGES.join("|");

  // "English → French", "English to French", "English into Spanish", etc.
  const named = new RegExp(`\\b(${langAlt})\\b\\s*${SEP}\\s*\\b(${langAlt})\\b`, "i");
  const m = text.match(named);
  if (m) return `${cap(m[1])} → ${cap(m[2])}`;

  // Codes: "EN>FR", "EN-DE", "EN > ES"
  const codeAlt = Object.keys(LANG_CODES).join("|");
  const coded = new RegExp(`\\b(${codeAlt})\\b\\s*${SEP}\\s*\\b(${codeAlt})\\b`, "i");
  const c = text.match(coded);
  if (c) {
    const a = LANG_CODES[c[1].toUpperCase()];
    const b = LANG_CODES[c[2].toUpperCase()];
    if (a && b) return `${a} → ${b}`;
  }

  if (/\b(multiple|several|various)\b.{0,20}\b(language|pair|combination)/i.test(text)) {
    return "Multiple pairs accepted";
  }
  return "";
}

function detectExperience(text: string): string {
  const years = text.match(/(\d+)\s*\+?\s*years?/i);
  if (years) return `${years[1]}+ years`;
  if (/\bnative\s+(speaker|level|proficiency)\b/i.test(text)) return "native speaker required";
  if (/\bentry[- ]level\b|\bjunior\b|\bno experience\b/i.test(text)) return "entry-level ok";
  if (/\bsenior\b|\bexperienced\b/i.test(text)) return "experienced";
  return "";
}

function detectApplyContact(text: string): string {
  const email = text.match(EMAIL_RE)?.[0] ?? "";
  const url = text.match(URL_RE)?.[0]?.replace(/[.,;]+$/, "") ?? "";
  if (email && url) return `${email} / ${url}`;
  return email || url;
}

function detectTitle(text: string, workType: string, pair: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // A short opening line that isn't a URL/email reads as a heading.
  for (const line of lines.slice(0, 4)) {
    if (line.length <= 90 && !EMAIL_RE.test(line) && !URL_RE.test(line) && /[a-z]/i.test(line)) {
      const words = line.split(/\s+/).length;
      if (words >= 2 && words <= 14) return line.replace(/[.:;]+$/, "");
    }
  }

  // Otherwise synthesise something sensible from what we found.
  if (workType || pair) {
    return [workType ? cap(workType) : "Translator", pair].filter(Boolean).join(" — ");
  }
  return lines[0] ?? "";
}

function detectInstructions(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cue =
    /\b(apply|send|submit|cv|resume|résumé|cover letter|portfolio|sample|subject line|deadline|rate|per word|per hour|€|\$|£|budget)\b/i;
  const hits = lines.filter((l) => cue.test(l) && !/^\s*$/.test(l));
  // Keep it concise — the first few relevant lines.
  return hits.slice(0, 4).join("\n");
}

// Builds a bullet outline from the posting so no detail is lost. Drops the
// title line and lines that are only a bare contact, keeps everything else.
function detectDescription(text: string, title: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((l) => l !== title)
    .filter((l) => !(EMAIL_RE.test(l) && l.length < 60))
    .filter((l) => !(URL_RE.test(l) && l.split(/\s+/).length <= 2))
    .map((l) => (l.startsWith("-") || l.startsWith("•") ? l : `- ${l}`));

  return bullets.join("\n");
}

export function extractJobFields(rawText: string): ParsedJobFields {
  const text = rawText.trim();
  const work_type = firstMatch(WORKTYPE_RULES, text);
  const domain = firstMatch(DOMAIN_RULES, text);
  const language_pair = detectLanguagePair(text);
  const title = detectTitle(text, work_type, language_pair);

  return {
    title,
    language_pair,
    domain,
    work_type,
    experience_required: detectExperience(text),
    apply_contact: detectApplyContact(text),
    description: detectDescription(text, title),
    application_instructions: detectInstructions(text),
  };
}

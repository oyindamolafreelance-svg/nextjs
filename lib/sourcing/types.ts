// A raw job pulled from an external source, before it's normalized into a
// listing. `apply_url` / `apply_email` are the most important fields — where a
// translator actually sends their application.
export interface RawJob {
  source_name: string; // e.g. "Remotive", "Greenhouse:welocalize"
  external_id: string; // stable id from the source (for de-duplication)
  title: string;
  description?: string;
  apply_url?: string;
  apply_email?: string;
  language_pair?: string;
  domain?: string;
  work_type?: string;
  company?: string;
  posted_at?: string; // ISO
}

export interface Connector {
  name: string;
  fetch(): Promise<RawJob[]>;
}

// Keep only language-industry roles. Broad but relevant.
const KEYWORDS =
  /\b(translat\w*|localis\w*|localiz\w*|linguist\w*|interpret\w*|subtitl\w*|MTPE|transcreat\w*|proofread\w*|multilingual|語 ?訳|traduc\w*)\b/i;

export function isTranslationRole(title: string, extra = ""): boolean {
  return KEYWORDS.test(`${title} ${extra}`);
}

// Small helper: fetch JSON with a timeout, tolerating failure (returns null).
export async function safeJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { accept: "application/json", "user-agent": "LinguaBoard/1.0", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function safeText(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "user-agent": "LinguaBoard/1.0", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

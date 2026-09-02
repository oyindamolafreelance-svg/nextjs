import { type Connector, type RawJob, isTranslationRole, safeText } from "./types";

// Universal reader: fetches a career/listing page and extracts any embedded
// schema.org JobPosting data (the structured data most sites publish for
// Google). Add page URLs to CAREER_PAGES to widen coverage — legal, since we
// only read the structured data a site publishes for machines, and link back.
const CAREER_PAGES: string[] = [];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function collectJobPostings(node: unknown, acc: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collectJobPostings(n, acc);
    return;
  }
  if (!isRecord(node)) return;
  const type = node["@type"];
  const isJob =
    type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
  if (isJob) acc.push(node);
  if ("@graph" in node) collectJobPostings(node["@graph"], acc);
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const acc: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      collectJobPostings(JSON.parse(m[1].trim()), acc);
    } catch {
      /* ignore malformed block */
    }
  }
  return acc;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function orgName(v: unknown): string {
  return isRecord(v) ? str(v.name) : "";
}

function pageConnector(pageUrl: string): Connector {
  const host = (() => {
    try {
      return new URL(pageUrl).host;
    } catch {
      return pageUrl;
    }
  })();
  return {
    name: `Schema:${host}`,
    async fetch() {
      const html = await safeText(pageUrl);
      if (!html) return [];
      const postings = extractJsonLd(html);
      const out: RawJob[] = [];
      for (const p of postings) {
        const title = str(p.title);
        const description = str(p.description)
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000);
        if (!title || !isTranslationRole(title, description)) continue;
        const url = str(p.url) || pageUrl;
        out.push({
          source_name: `Schema:${host}`,
          external_id: url || title,
          title,
          description,
          apply_url: url,
          company: orgName(p.hiringOrganization),
          posted_at: str(p.datePosted) || undefined,
        });
      }
      return out;
    },
  };
}

export const SCHEMA_CONNECTORS: Connector[] = CAREER_PAGES.map(pageConnector);

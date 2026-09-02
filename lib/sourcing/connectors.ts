import { type Connector, type RawJob, isTranslationRole, safeJson } from "./types";
import { RSS_CONNECTORS } from "./rss";
import { SCHEMA_CONNECTORS } from "./schema-org";

function stripHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

// --- Free job-board APIs -----------------------------------------------------

const remotive: Connector = {
  name: "Remotive",
  async fetch() {
    const data = (await safeJson(
      "https://remotive.com/api/remote-jobs?search=translation&limit=50"
    )) as { jobs?: Record<string, unknown>[] } | null;
    const jobs = data?.jobs ?? [];
    return jobs
      .filter((j) => isTranslationRole(String(j.title ?? ""), String(j.tags ?? "")))
      .map<RawJob>((j) => ({
        source_name: "Remotive",
        external_id: String(j.id),
        title: String(j.title ?? "").trim(),
        description: stripHtml(String(j.description ?? "")),
        apply_url: String(j.url ?? ""),
        company: String(j.company_name ?? ""),
        posted_at: typeof j.publication_date === "string" ? j.publication_date : undefined,
      }));
  },
};

const remoteok: Connector = {
  name: "RemoteOK",
  async fetch() {
    const data = (await safeJson("https://remoteok.com/api")) as Record<string, unknown>[] | null;
    const jobs = Array.isArray(data) ? data.slice(1) : []; // first item is a legal notice
    return jobs
      .filter(
        (j) =>
          j &&
          typeof j === "object" &&
          isTranslationRole(String(j.position ?? ""), String((j.tags as string[])?.join(" ") ?? ""))
      )
      .map<RawJob>((j) => ({
        source_name: "RemoteOK",
        external_id: String(j.id ?? j.slug),
        title: String(j.position ?? "").trim(),
        description: stripHtml(String(j.description ?? "")),
        apply_url: String(j.url ?? ""),
        company: String(j.company ?? ""),
        posted_at: typeof j.date === "string" ? j.date : undefined,
      }));
  },
};

const arbeitnow: Connector = {
  name: "Arbeitnow",
  async fetch() {
    const data = (await safeJson("https://www.arbeitnow.com/api/job-board-api")) as {
      data?: Record<string, unknown>[];
    } | null;
    const jobs = data?.data ?? [];
    return jobs
      .filter((j) =>
        isTranslationRole(String(j.title ?? ""), String((j.tags as string[])?.join(" ") ?? ""))
      )
      .map<RawJob>((j) => ({
        source_name: "Arbeitnow",
        external_id: String(j.slug),
        title: String(j.title ?? "").trim(),
        description: stripHtml(String(j.description ?? "")),
        apply_url: String(j.url ?? ""),
        company: String(j.company_name ?? ""),
      }));
  },
};

const jobicy: Connector = {
  name: "Jobicy",
  async fetch() {
    const data = (await safeJson("https://jobicy.com/api/v2/remote-jobs?count=50")) as {
      jobs?: Record<string, unknown>[];
    } | null;
    const jobs = data?.jobs ?? [];
    return jobs
      .filter((j) =>
        isTranslationRole(
          String(j.jobTitle ?? ""),
          `${j.jobIndustry ?? ""} ${j.jobType ?? ""}`
        )
      )
      .map<RawJob>((j) => ({
        source_name: "Jobicy",
        external_id: String(j.id),
        title: String(j.jobTitle ?? "").trim(),
        description: stripHtml(String(j.jobExcerpt ?? j.jobDescription ?? "")),
        apply_url: String(j.url ?? ""),
        company: String(j.companyName ?? ""),
        posted_at: typeof j.pubDate === "string" ? j.pubDate : undefined,
      }));
  },
};

// --- Applicant tracking systems (public JSON feeds) --------------------------
// Seed lists — replace/extend with agencies you trust. Wrong slugs just 404
// and are skipped, so this is safe to grow over time.
const GREENHOUSE_SLUGS = ["lilt", "smartling", "verbit", "deepl", "unbabel"];
const LEVER_SLUGS = ["welocalize", "smartcat"];
const SMARTRECRUITERS_SLUGS = ["TransPerfect", "Lionbridge"];
const RECRUITEE_SLUGS: string[] = [];

function greenhouse(slug: string): Connector {
  return {
    name: `Greenhouse:${slug}`,
    async fetch() {
      const data = (await safeJson(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
      )) as { jobs?: Record<string, unknown>[] } | null;
      const jobs = data?.jobs ?? [];
      return jobs
        .filter((j) => isTranslationRole(String(j.title ?? "")))
        .map<RawJob>((j) => ({
          source_name: `Greenhouse:${slug}`,
          external_id: String(j.id),
          title: String(j.title ?? "").trim(),
          description: stripHtml(String(j.content ?? "")),
          apply_url: String(j.absolute_url ?? ""),
          company: slug,
          posted_at: typeof j.updated_at === "string" ? j.updated_at : undefined,
        }));
    },
  };
}

function lever(slug: string): Connector {
  return {
    name: `Lever:${slug}`,
    async fetch() {
      const data = (await safeJson(
        `https://api.lever.co/v0/postings/${slug}?mode=json`
      )) as Record<string, unknown>[] | null;
      const jobs = Array.isArray(data) ? data : [];
      return jobs
        .filter((j) => isTranslationRole(String(j.text ?? "")))
        .map<RawJob>((j) => ({
          source_name: `Lever:${slug}`,
          external_id: String(j.id),
          title: String(j.text ?? "").trim(),
          description: stripHtml(String(j.descriptionPlain ?? j.description ?? "")),
          apply_url: String(j.hostedUrl ?? ""),
          company: slug,
        }));
    },
  };
}

function smartrecruiters(slug: string): Connector {
  return {
    name: `SmartRecruiters:${slug}`,
    async fetch() {
      const data = (await safeJson(
        `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`
      )) as { content?: Record<string, unknown>[] } | null;
      const jobs = data?.content ?? [];
      return jobs
        .filter((j) => isTranslationRole(String(j.name ?? "")))
        .map<RawJob>((j) => ({
          source_name: `SmartRecruiters:${slug}`,
          external_id: String(j.id),
          title: String(j.name ?? "").trim(),
          apply_url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
          company: slug,
          posted_at: typeof j.releasedDate === "string" ? j.releasedDate : undefined,
        }));
    },
  };
}

function recruitee(slug: string): Connector {
  return {
    name: `Recruitee:${slug}`,
    async fetch() {
      const data = (await safeJson(`https://${slug}.recruitee.com/api/offers/`)) as {
        offers?: Record<string, unknown>[];
      } | null;
      const jobs = data?.offers ?? [];
      return jobs
        .filter((j) => isTranslationRole(String(j.title ?? "")))
        .map<RawJob>((j) => ({
          source_name: `Recruitee:${slug}`,
          external_id: String(j.id),
          title: String(j.title ?? "").trim(),
          description: stripHtml(String(j.description ?? "")),
          apply_url: String(j.careers_url ?? j.careers_apply_url ?? ""),
          company: slug,
        }));
    },
  };
}

export const CONNECTORS: Connector[] = [
  remotive,
  remoteok,
  arbeitnow,
  jobicy,
  ...GREENHOUSE_SLUGS.map(greenhouse),
  ...LEVER_SLUGS.map(lever),
  ...SMARTRECRUITERS_SLUGS.map(smartrecruiters),
  ...RECRUITEE_SLUGS.map(recruitee),
  ...RSS_CONNECTORS,
  ...SCHEMA_CONNECTORS,
];

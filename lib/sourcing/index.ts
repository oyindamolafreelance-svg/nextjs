import { CONNECTORS } from "./connectors";
import type { RawJob } from "./types";

// A normalized row ready to upsert into public.jobs as a pending sourced lead.
export interface SourcedInsert {
  title: string;
  language_pair: string;
  domain: string;
  work_type: string;
  apply_contact: string;
  description: string | null;
  source: string | null;
  source_url: string | null;
  source_name: string;
  external_id: string;
  review_status: "pending";
  posted_by: null;
  is_active: true;
  date_posted: string;
  expires_at: string;
}

const EXPIRY_DAYS = 30;

function toInsert(raw: RawJob): SourcedInsert | null {
  const applyContact = (raw.apply_email || raw.apply_url || "").trim();
  const title = raw.title.trim();
  // The apply target is essential — skip anything we can't apply to.
  if (!title || !applyContact) return null;

  const now = new Date();
  const posted = raw.posted_at ? new Date(raw.posted_at) : now;
  const postedValid = !Number.isNaN(posted.getTime()) ? posted : now;

  return {
    title: title.slice(0, 300),
    language_pair: raw.language_pair?.trim() || "See posting",
    domain: raw.domain?.trim() || "general",
    work_type: raw.work_type?.trim() || "translation",
    apply_contact: applyContact.slice(0, 500),
    description: raw.description?.trim()
      ? `${raw.description.trim()}${raw.company ? `\n\nCompany: ${raw.company}` : ""}`
      : raw.company
        ? `Company: ${raw.company}`
        : null,
    source: raw.source_name,
    source_url: raw.apply_url ?? null,
    source_name: raw.source_name,
    external_id: raw.external_id,
    review_status: "pending",
    posted_by: null,
    is_active: true,
    date_posted: postedValid.toISOString(),
    expires_at: new Date(now.getTime() + EXPIRY_DAYS * 86_400_000).toISOString(),
  };
}

export interface SourceRunResult {
  rows: SourcedInsert[];
  perConnector: { name: string; found: number; error: boolean }[];
}

// Run every connector (isolated — one failure never stops the others), collect
// and de-duplicate the results into ready-to-insert rows.
export async function collectSourcedJobs(): Promise<SourceRunResult> {
  const perConnector: SourceRunResult["perConnector"] = [];
  const seen = new Set<string>();
  const rows: SourcedInsert[] = [];

  const results = await Promise.allSettled(
    CONNECTORS.map(async (c) => ({ name: c.name, jobs: await c.fetch() }))
  );

  for (const r of results) {
    if (r.status === "rejected") {
      perConnector.push({ name: "unknown", found: 0, error: true });
      continue;
    }
    const { name, jobs } = r.value;
    let found = 0;
    for (const raw of jobs) {
      const key = `${raw.source_name}::${raw.external_id}`;
      if (seen.has(key)) continue;
      const insert = toInsert(raw);
      if (!insert) continue;
      seen.add(key);
      rows.push(insert);
      found++;
    }
    perConnector.push({ name, found, error: false });
  }

  return { rows, perConnector };
}

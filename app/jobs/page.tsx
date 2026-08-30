import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";
import { JobFilters, type FilterOptions } from "./JobFilters";
import { JobCard } from "./JobCard";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

function pick(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireApproved("/jobs");
  const sp = await searchParams;

  const languagePair = pick(sp, "language_pair");
  const domain = pick(sp, "domain");
  const workType = pick(sp, "work_type");

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // Only active, non-expired listings are ever shown to members. Filtering by
  // expires_at here means a listing disappears the moment it lapses, even
  // before the daily cron flips is_active. `activeOr` is reused on each query.
  const activeOr = `expires_at.is.null,expires_at.gt.${nowIso}`;

  // Filter option lists come from ALL active listings so choosing one filter
  // never makes the others' options vanish.
  const { data: optionRows } = await supabase
    .from("jobs")
    .select("language_pair, domain, work_type")
    .eq("is_active", true)
    .or(activeOr);

  const options: FilterOptions = {
    language_pair: uniqueSorted((optionRows ?? []).map((r) => r.language_pair)),
    domain: uniqueSorted((optionRows ?? []).map((r) => r.domain)),
    work_type: uniqueSorted((optionRows ?? []).map((r) => r.work_type)),
  };

  let query = supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .or(activeOr)
    .order("date_posted", { ascending: false });
  if (languagePair) query = query.eq("language_pair", languagePair);
  if (domain) query = query.eq("domain", domain);
  if (workType) query = query.eq("work_type", workType);

  const { data: jobs, error } = await query.returns<Job[]>();

  const hasFilters = Boolean(languagePair || domain || workType);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Job board</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Curated translation &amp; localization openings, newest first.
        </p>
      </div>

      <JobFilters options={options} />

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
          Couldn&apos;t load listings right now. Please try again shortly.
        </p>
      ) : !jobs || jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">
            {hasFilters
              ? "No jobs match your filters yet."
              : "No active listings right now."}
          </p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {hasFilters
              ? "Try widening or clearing your filters."
              : "Check back soon — new listings are added regularly."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-black/50 dark:text-white/50">
            {jobs.length} listing{jobs.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

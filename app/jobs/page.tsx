import Link from "next/link";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";
import { JobFilters, type FilterOptions } from "./JobFilters";
import { JobCard } from "./JobCard";

export const dynamic = "force-dynamic";

// Daily give-to-get threshold (mirrors daily_post_quota() in the DB).
const DAILY_QUOTA = 5;

function JobsGate({ postedToday, quota }: { postedToday: number; quota: number }) {
  const remaining = Math.max(0, quota - postedToday);
  const pct = Math.min(100, Math.round((postedToday / quota) * 100));
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-8">
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        Locked for today
      </span>
      <h1 className="text-2xl font-semibold">Post to unlock the board</h1>
      <p className="text-black/70 dark:text-white/70">
        To keep the board full of fresh leads, you unlock browsing by
        contributing. Post <strong>{quota} distinct jobs today</strong> and the
        full board opens for the rest of the day.
      </p>
      <div className="w-full">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-medium">
            {postedToday} / {quota} posted today
          </span>
          <span className="text-black/50 dark:text-white/50">
            {remaining} to go
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-black/70 dark:bg-white/70"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Link
        href="/post-job"
        className="mt-2 rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Post a job
      </Link>
    </div>
  );
}

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
  const user = await requireApproved("/jobs");
  const sp = await searchParams;
  const supabase = await createClient();

  // Give-to-get: non-admins must post the daily quota before browsing other
  // members' listings. RLS enforces this at the data layer too; this is the
  // friendly UX gate that explains it.
  // Admins and "direct access" (exempt) members skip the give-to-get gate.
  if (!user.profile.is_admin && !user.profile.is_exempt) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: postedCount } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("posted_by", user.id)
      .gte("date_posted", startOfDay.toISOString());
    const postedToday = postedCount ?? 0;
    if (postedToday < DAILY_QUOTA) {
      return <JobsGate postedToday={postedToday} quota={DAILY_QUOTA} />;
    }
  }

  const languagePair = pick(sp, "language_pair");
  const domain = pick(sp, "domain");
  const workType = pick(sp, "work_type");
  // Strip characters that would break the PostgREST or-filter syntax.
  const q = pick(sp, "q")?.replace(/[,%()*]/g, " ").trim();

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
  if (q) {
    query = query.or(
      `title.ilike.%${q}%,description.ilike.%${q}%,domain.ilike.%${q}%,language_pair.ilike.%${q}%,work_type.ilike.%${q}%`
    );
  }

  const { data: jobs, error } = await query.returns<Job[]>();

  // Mark which listings the viewer has bookmarked.
  const { data: bookmarkRows } = await supabase
    .from("job_bookmarks")
    .select("job_id")
    .eq("user_id", user.id);
  const savedIds = new Set((bookmarkRows ?? []).map((b) => b.job_id));

  const hasFilters = Boolean(languagePair || domain || workType || q);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Job board</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Curated translation &amp; localization openings, newest first.
        </p>
      </div>

      <JobFilters options={options} query={q ?? ""} />

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
              <JobCard key={job.id} job={job} saved={savedIds.has(job.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

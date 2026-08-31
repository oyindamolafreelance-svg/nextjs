import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ReportRow {
  id: string;
  job_id: string;
  reporter_id: string;
  reason: string | null;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ReportsPage() {
  await requireAdmin("/admin/reports");
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("job_reports")
    .select("id, job_id, reporter_id, reason, created_at")
    .order("created_at", { ascending: false })
    .returns<ReportRow[]>();

  const jobIds = [...new Set((reports ?? []).map((r) => r.job_id))];
  const reporterIds = [...new Set((reports ?? []).map((r) => r.reporter_id))];

  const [{ data: jobs }, { data: people }] = await Promise.all([
    jobIds.length
      ? supabase.from("jobs").select("id, title").in("id", jobIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    reporterIds.length
      ? supabase.from("profiles").select("id, email, full_name").in("id", reporterIds)
      : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null }[] }),
  ]);

  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));
  const reporter = new Map(
    (people ?? []).map((p) => [p.id, p.full_name || p.email])
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reported listings</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Flags submitted by members. Review and remove listings from the
          board via each poster&apos;s controls or the database.
        </p>
      </div>

      {!reports || reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">No reports.</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            When a member flags a listing, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {jobTitle.get(r.job_id) ?? "(deleted listing)"}
                </span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {formatDate(r.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm text-black/70 dark:text-white/70">
                {r.reason ? r.reason : <em>No reason given</em>}
              </p>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Reported by {reporter.get(r.reporter_id) ?? "Unknown"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

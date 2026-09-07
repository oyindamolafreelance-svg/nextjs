import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PostJobForm } from "./PostJobForm";

export const dynamic = "force-dynamic";

export default async function PostJobPage() {
  const user = await requireApproved("/post-job");
  const supabase = await createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ count }, { data: quotaData }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("posted_by", user.id)
      .gte("date_posted", startOfDay.toISOString()),
    supabase.rpc("my_daily_quota"),
  ]);

  const quota = typeof quotaData === "number" ? quotaData : 5;
  const postedToday = count ?? 0;
  const remaining = Math.max(0, quota - postedToday);
  const gated = !user.profile.is_admin && !user.profile.is_exempt && quota > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Post a job</h1>
        <p className="mt-1 text-sm muted">
          Share a curated listing. Use the AI helper to pre-fill fields from a
          pasted posting, then review before publishing.
        </p>
      </div>

      {gated && (
        <div className="card p-4 text-sm">
          <p className="font-medium">
            You&apos;ve posted {postedToday} of {quota} jobs today.
          </p>
          <p className="mt-1 muted">
            {remaining > 0
              ? `Post ${remaining} more distinct listing${remaining === 1 ? "" : "s"} today to unlock browsing the full board.`
              : "You've unlocked the full board for today. 🎉"}
          </p>
        </div>
      )}

      <PostJobForm />
    </div>
  );
}

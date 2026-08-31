import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PostJobForm } from "./PostJobForm";

export const dynamic = "force-dynamic";

const DAILY_QUOTA = 5;

export default async function PostJobPage() {
  const user = await requireApproved("/post-job");
  const supabase = await createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("posted_by", user.id)
    .gte("date_posted", startOfDay.toISOString());

  const postedToday = count ?? 0;
  const remaining = Math.max(0, DAILY_QUOTA - postedToday);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Post a job</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Share a curated listing. Use the AI helper to pre-fill fields from a
          pasted posting, then review before publishing.
        </p>
      </div>

      {!user.profile.is_admin && (
        <div className="rounded-lg border border-black/10 bg-black/[.03] p-4 text-sm dark:border-white/10 dark:bg-white/[.04]">
          <p className="font-medium">
            You&apos;ve posted {postedToday} of {DAILY_QUOTA} jobs today.
          </p>
          <p className="mt-1 text-black/60 dark:text-white/60">
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

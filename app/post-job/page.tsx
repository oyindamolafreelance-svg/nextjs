import { requireApproved } from "@/lib/auth";
import { PostJobForm } from "./PostJobForm";

export const dynamic = "force-dynamic";

// Board is open (see /jobs). Posting is encouraged for tiers, not required
// to browse. Flip to false to re-enable the give-to-get gate messaging.
const OPEN_BOARD = true;

export default async function PostJobPage() {
  await requireApproved("/post-job");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Post a job</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Share a curated listing. Use the AI helper to pre-fill fields from a
          pasted posting, then review before publishing.
        </p>
      </div>

      {OPEN_BOARD && (
        <div className="rounded-lg border border-black/10 bg-black/[.03] p-4 text-sm dark:border-white/10 dark:bg-white/[.04]">
          <p className="text-black/70 dark:text-white/70">
            The board is open to everyone — posting isn&apos;t required to
            browse. But every listing you share helps the community and climbs
            your{" "}
            <a href="/progress" className="underline">
              contribution tier
            </a>
            . 🙌
          </p>
        </div>
      )}

      <PostJobForm />
    </div>
  );
}

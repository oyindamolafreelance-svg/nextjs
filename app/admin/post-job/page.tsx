import { requireAdmin } from "@/lib/auth";
import { PostJobForm } from "./PostJobForm";

export default async function PostJobPage() {
  await requireAdmin("/admin/post-job");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Post a job</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Add a curated listing. Use the AI helper to pre-fill fields from a
          pasted posting, then review before publishing.
        </p>
      </div>
      <PostJobForm />
    </div>
  );
}

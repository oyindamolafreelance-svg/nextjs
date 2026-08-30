import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ApproveButton } from "./ApproveButton";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ApprovalsPage() {
  await requireAdmin("/admin/approvals");
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_approved", false)
    .order("created_at", { ascending: true })
    .returns<Profile[]>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Pending approvals</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Registered accounts awaiting access to the job board.
        </p>
      </div>

      {!pending || pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">No pending registrations.</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            New sign-ups will appear here for review.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div>
                <p className="font-medium">{p.full_name ?? "—"}</p>
                <p className="text-sm text-black/60 dark:text-white/60">{p.email}</p>
                <p className="text-xs text-black/40 dark:text-white/40">
                  Registered {formatDate(p.created_at)}
                </p>
              </div>
              <ApproveButton userId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

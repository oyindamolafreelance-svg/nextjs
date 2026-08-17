import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function PendingPage() {
  const user = await requireUser("/pending");
  if (user.profile.is_approved) redirect("/jobs");

  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-8">
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        Pending approval
      </span>
      <h1 className="text-2xl font-semibold">Your account is awaiting approval</h1>
      <p className="text-black/70 dark:text-white/70">
        Thanks for registering, {user.profile.full_name ?? user.email}. The site
        owner reviews new accounts before granting access to the job board.
        You&apos;ll be able to browse listings as soon as your account is
        approved — just check back and log in again.
      </p>
      <p className="text-sm text-black/50 dark:text-white/50">
        Signed in as {user.email}.
      </p>
    </div>
  );
}

import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";

export async function Nav() {
  const user = await getSessionUser();
  const approved = user?.profile.is_approved;
  const admin = user?.profile.is_admin;

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          LinguaBoard
        </Link>

        <nav className="flex flex-1 flex-wrap gap-4 text-sm text-black/70 dark:text-white/70">
          {approved && (
            <>
              <Link href="/jobs" className="hover:text-current">
                Jobs
              </Link>
              <Link href="/post-job" className="hover:text-current">
                Post a job
              </Link>
              <Link href="/my-posts" className="hover:text-current">
                My posts
              </Link>
              <Link href="/saved" className="hover:text-current">
                Saved
              </Link>
              <Link href="/progress" className="hover:text-current">
                Progress
              </Link>
              <Link href="/leaderboard" className="hover:text-current">
                Leaderboard
              </Link>
            </>
          )}
          {admin && (
            <>
              <Link href="/admin/approvals" className="hover:text-current">
                Approvals
              </Link>
              <Link href="/admin/sourced" className="hover:text-current">
                Sourced
              </Link>
              <Link href="/admin/reports" className="hover:text-current">
                Reports
              </Link>
              <Link href="/admin/analytics" className="hover:text-current">
                Analytics
              </Link>
              <Link href="/admin/dashboard" className="hover:text-current">
                Dashboard
              </Link>
            </>
          )}
        </nav>

        {user ? (
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-black/50 hover:text-current dark:text-white/50"
            >
              Sign out
            </button>
          </form>
        ) : (
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="text-black/70 hover:text-current dark:text-white/70">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-black px-3 py-1.5 font-medium text-white dark:bg-white dark:text-black"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

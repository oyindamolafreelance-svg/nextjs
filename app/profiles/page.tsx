import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = await db.profile.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profiles</h1>
        <Link
          href="/profiles/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          New profile
        </Link>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No profiles yet. Each profile is one platform account with its own niche and brand kit.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Link
                href={`/profiles/${profile.id}`}
                className="block rounded-lg border border-black/10 p-4 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{profile.name}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    {profile.platform}
                  </span>
                </div>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">{profile.niche}</p>
                <p className="mt-2 text-xs">
                  {profile.connected ? (
                    <span className="text-green-600 dark:text-green-400">Connected</span>
                  ) : (
                    <span className="text-black/40 dark:text-white/40">Not connected</span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

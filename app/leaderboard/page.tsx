import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tierByName } from "@/lib/tiers";

export const dynamic = "force-dynamic";

interface Row {
  display: string;
  posts: number;
  tier: string;
}

export default async function LeaderboardPage() {
  await requireApproved("/leaderboard");
  const supabase = await createClient();

  const { data } = await supabase.rpc("leaderboard");
  const rows: Row[] = Array.isArray(data) ? data : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Top contributors by listings posted.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">No contributors yet.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const tier = tierByName(r.tier);
            return (
              <li
                key={`${r.display}-${i}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-semibold tabular-nums text-black/40 dark:text-white/40">
                    {i + 1}
                  </span>
                  <span className="font-medium">{r.display}</span>
                  <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs dark:bg-white/10">
                    {tier.emoji} {tier.name}
                  </span>
                </div>
                <span className="text-sm tabular-nums text-black/60 dark:text-white/60">
                  {r.posts} post{r.posts === 1 ? "" : "s"}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

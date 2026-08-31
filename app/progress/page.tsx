import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIERS, tierByName, tierIndex } from "@/lib/tiers";

export const dynamic = "force-dynamic";

interface Progress {
  posts: number;
  active_days: number;
  clicks: number;
  tier: string;
  quota: number;
}

function Meter({ have, need, label }: { have: number; need: number; label: string }) {
  const pct = need === 0 ? 100 : Math.min(100, Math.round((have / need) * 100));
  const done = have >= need;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-black/60 dark:text-white/60">{label}</span>
        <span className={done ? "text-green-700 dark:text-green-400" : ""}>
          {have} / {need} {done ? "✓" : ""}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-black/70 dark:bg-white/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function ProgressPage() {
  await requireApproved("/progress");
  const supabase = await createClient();

  const { data } = await supabase.rpc("my_progress");
  const p: Progress = Array.isArray(data) && data[0]
    ? data[0]
    : { posts: 0, active_days: 0, clicks: 0, tier: "Newcomer", quota: 5 };

  const current = tierByName(p.tier);
  const idx = tierIndex(p.tier);
  const next = TIERS[idx + 1];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Your progress</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Contribute consistently to climb tiers and ease your daily unlock.
        </p>
      </div>

      <section className="rounded-lg border border-black/10 p-5 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              Current tier
            </p>
            <p className="text-2xl font-semibold">
              {current.emoji} {current.name}
            </p>
          </div>
          <div className="text-right text-sm text-black/60 dark:text-white/60">
            <p>
              {p.posts} posts · {p.active_days} active days · {p.clicks} clicks
              earned
            </p>
            <p className="mt-1">
              {p.quota === 0
                ? "Permanent browse access 🎉"
                : `Daily unlock: ${p.quota} post${p.quota === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {next && (
          <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10">
            <p className="mb-3 text-sm font-medium">
              Next: {next.emoji} {next.name} — {next.perk}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Meter have={p.posts} need={next.minPosts} label="Posts" />
              <Meter have={p.active_days} need={next.minActiveDays} label="Active days" />
              <Meter have={p.clicks} need={next.minClicks} label="Clicks earned" />
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">The ladder</h2>
        <ul className="flex flex-col gap-2">
          {TIERS.map((t, i) => (
            <li
              key={t.name}
              className={
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4 " +
                (i === idx
                  ? "border-black/40 bg-black/[.04] dark:border-white/40 dark:bg-white/[.06]"
                  : "border-black/10 dark:border-white/10")
              }
            >
              <div>
                <p className="font-medium">
                  {t.emoji} {t.name}
                  {i === idx && (
                    <span className="ml-2 text-xs text-black/50 dark:text-white/50">
                      (you)
                    </span>
                  )}
                </p>
                <p className="text-xs text-black/60 dark:text-white/60">{t.perk}</p>
              </div>
              <p className="text-xs text-black/50 dark:text-white/50">
                {t.minPosts === 0
                  ? "Starting tier"
                  : `${t.minPosts} posts · ${t.minActiveDays} active days · ${t.minClicks} clicks`}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

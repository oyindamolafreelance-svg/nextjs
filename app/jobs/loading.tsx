// Shown instantly while the board data loads, so navigation feels fast.
export default function LoadingJobs() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-40 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-24 w-full rounded-lg bg-black/5 dark:bg-white/5" />
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 w-full rounded-lg border border-black/10 bg-black/[.02] dark:border-white/10 dark:bg-white/[.02]"
          />
        ))}
      </div>
    </div>
  );
}

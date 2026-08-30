import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

const features = [
  {
    title: "Curated, not scraped",
    body: "Every listing is hand-picked from ProZ, LinkedIn, agency career pages and beyond, then re-entered in a clean, consistent format.",
  },
  {
    title: "Built for language pros",
    body: "Filter by language pair, domain and work type — translation, localization, MTPE, subtitling, proofreading and more.",
  },
  {
    title: "Members only",
    body: "Listings are visible to approved members only. No public scraping, no noise, no recruiters cold-calling your inbox.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="flex flex-col gap-16 py-8">
      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium text-black/60 dark:border-white/20 dark:text-white/60">
          Invite-only · Translation &amp; Localization
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          The curated job board for translators and localizers.
        </h1>
        <p className="max-w-xl text-lg text-black/70 dark:text-white/70">
          We track the web for genuine translation and localization openings and
          post them here in one clean, searchable place. Register for a free
          account, and once you&apos;re approved you&apos;ll get full access to
          the board.
        </p>
        <div className="flex flex-wrap gap-3">
          {user?.profile.is_approved ? (
            <Link
              href="/jobs"
              className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Browse the job board
            </Link>
          ) : user ? (
            <Link
              href="/pending"
              className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Check your account status
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
              >
                Register for access
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-black/15 px-5 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-black/10 p-5 dark:border-white/10"
          >
            <h2 className="mb-2 font-medium">{f.title}</h2>
            <p className="text-sm text-black/70 dark:text-white/70">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-2 text-lg font-medium">How access works</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-black/70 dark:text-white/70">
          <li>Register with your name, email and a password.</li>
          <li>
            Your account starts as <em>pending</em> — the site owner reviews new
            registrations.
          </li>
          <li>
            Once approved, log in any time to browse and filter the full board.
          </li>
        </ol>
      </section>
    </div>
  );
}

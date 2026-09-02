import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

const features = [
  {
    icon: "🎯",
    title: "Curated & sourced",
    body: "Hand-picked listings plus jobs pulled automatically from trusted translation sources — all in one clean place.",
  },
  {
    icon: "🌐",
    title: "Built for language pros",
    body: "Filter by language pair, domain and work type — translation, localization, MTPE, subtitling, proofreading and more.",
  },
  {
    icon: "🔒",
    title: "Members only",
    body: "Listings are visible to approved members only. No public scraping, no noise, no recruiters cold-calling your inbox.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="flex flex-col gap-14 py-6">
      {/* Hero */}
      <section className="card overflow-hidden">
        <div className="relative px-6 py-14 sm:px-10 sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(60% 120% at 15% 0%, var(--brand-weak), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-start gap-6">
            <span className="chip">Invite-only · Translation &amp; Localization</span>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              The curated job board for{" "}
              <span className="text-[color:var(--brand)]">translators</span> and
              localizers.
            </h1>
            <p className="max-w-xl text-lg muted">
              We track the web for genuine translation and localization openings
              and post them here in one clean, searchable place. Register free —
              once you&apos;re approved you get full access.
            </p>
            <div className="flex flex-wrap gap-3">
              {user?.profile.is_approved ? (
                <Link href="/jobs" className="btn btn-primary px-5 py-2.5">
                  Browse the job board
                </Link>
              ) : user ? (
                <Link href="/pending" className="btn btn-primary px-5 py-2.5">
                  Check your account status
                </Link>
              ) : (
                <>
                  <Link href="/register" className="btn btn-primary px-5 py-2.5">
                    Register for access
                  </Link>
                  <Link href="/login" className="btn btn-secondary px-5 py-2.5">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-5 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card p-6">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--brand-weak)] text-xl">
              {f.icon}
            </div>
            <h2 className="mb-1.5 font-semibold">{f.title}</h2>
            <p className="text-sm muted">{f.body}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="card p-6 sm:p-8">
        <h2 className="mb-4 text-lg font-semibold">How access works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Register", "Sign up with your name, email and a password."],
            ["2", "Get approved", "The site owner reviews new accounts — a quick, spam-free gate."],
            ["3", "Browse & apply", "Search, filter, save jobs, and even draft applications with AI."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--brand)] text-sm font-semibold text-white">
                {n}
              </span>
              <div>
                <p className="font-medium">{t}</p>
                <p className="text-sm muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

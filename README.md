# LinguaBoard

A private, invite-gated job board for the translation & localization niche.
The site owner (admin) curates job postings found across the web (ProZ,
LinkedIn, Google Jobs, agency career pages) and enters them here in a
structured format. Approved members browse and apply; the public sees only a
landing page and the registration form.

## How it fits together

- **Next.js 16** (App Router) — server-rendered pages + a couple of route
  handlers.
- **Supabase** — Postgres database, email/password auth, and Row Level
  Security. RLS is the real access-control boundary; the app never trusts the
  client.
- **Anthropic API** — powers the admin "auto-fill from pasted text" helper on
  the post-a-job form (parses raw postings into structured fields).
- **Vercel** — hosting + a daily cron that expires stale listings.

### Access model

| Role | Sees |
| --- | --- |
| Public visitor | Landing page + `/register` + `/login` only |
| Registered, pending | A "pending approval" screen |
| Approved member | The full `/jobs` board (search + filter) |
| Admin | Everything, plus approvals, post-a-job, and a stats dashboard |

Gating is enforced in three layers: `proxy.ts` (optimistic redirects), the
`lib/auth.ts` Data Access Layer (`requireApproved` / `requireAdmin`), and —
authoritatively — Supabase RLS policies (`supabase/migrations/`).

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Create the Supabase project

1. Create a free project at https://supabase.com.
2. From **Settings → API**, copy the values into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by the cron route)
3. In **Authentication → Providers → Email**, keep email/password enabled.
   For the smoothest flow described in the spec (register → log in → see the
   pending screen), turn **"Confirm email" off**. With it on, users must click
   an email link before their first login — the app handles both.

### 3. Apply the database schema

The schema and RLS policies live in `supabase/migrations/` and are the source
of truth — don't make untracked changes in the dashboard.

- **Supabase CLI** (recommended): `supabase db push`
- **Or** paste each file, in order, into the Supabase SQL editor:
  1. `supabase/migrations/0001_initial_schema.sql`
  2. `supabase/migrations/0002_rls_policies.sql`

### 4. Create the admin

Register through the app once (so the auth user + profile row exist), then run
`supabase/promote-admin.sql` in the SQL editor with your email to set
`is_admin` and `is_approved`.

### 5. AI auto-fill (optional but recommended)

Set `ANTHROPIC_API_KEY` to enable the "Auto-fill fields" button on
`/admin/post-job`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5`. Without a
key, the admin fills the form manually — nothing else is affected.

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Deployment (Vercel)

1. Push this repo to GitHub and import it into Vercel.
2. Add all the env vars from `.env.example` in the Vercel project settings.
3. Deploy. The app is reachable at the free `*.vercel.app` URL. A custom
   domain can be added later in Vercel's domain settings with **no code
   changes** — the app derives no URLs from a hardcoded host.

### Auto-expiring listings

`vercel.json` schedules `/api/cron/expire-jobs` once a day (the maximum
frequency on Vercel's free Hobby plan). It flips `is_active → false` for any
listing whose `expires_at` has passed. Set `CRON_SECRET` so the route rejects
unauthenticated calls — Vercel Cron sends it as a Bearer token automatically.

The board also hides expired listings at query time, so a lapsed listing
disappears immediately even before the daily cron runs.

You can trigger it manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.vercel.app/api/cron/expire-jobs
```

## Project structure

```
app/
  page.tsx                 Landing page
  register/ login/         Auth (Supabase email/password)
  pending/                 "Awaiting approval" screen
  jobs/                    Member job board (search + filter)
  admin/approvals/         Approve pending registrations
  admin/post-job/          Job form + AI auto-fill
  admin/dashboard/         Stats
  api/parse-job/           Anthropic-backed auto-fill (admin only)
  api/cron/expire-jobs/    Daily expiry sweep
lib/
  supabase/                server / browser / admin clients
  auth.ts                  Data Access Layer + role guards
  actions/                 Server actions (auth, approvals, job posting)
  ai/parse-job.ts          Anthropic call for the auto-fill helper
supabase/migrations/       Schema + RLS (source of truth)
```

## Scope

**Built (v1):** registration + login + admin approval, job board with
search/filter, admin job posting with AI auto-fill, auto-expiry, admin stats.

**Not built yet (v2):** duplicate-listing detection, weekly email digest
(Resend), and member bookmarks — left as clean extension points.

## Development

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
```

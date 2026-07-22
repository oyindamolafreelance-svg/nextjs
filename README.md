# Autopost

Automates posting to TikTok and Facebook. Each **profile** is one platform
account with its own niche and brand kit (tone, hashtags, colors, logo), so
generated captions stay on-brand and consistent per account. Posts can be
written manually or generated with AI, scheduled for later, and a cron job
publishes anything due.

## How it fits together

- **Next.js 16** app (App Router) — dashboard UI + API routes.
- **Postgres** via Prisma 7 (driver adapters) — profiles, posts.
- **TikTok Content Posting API** / **Facebook Graph API** — actual publishing.
- **A cron trigger** (Vercel Cron or the included GitHub Action) hits
  `/api/cron/publish` on a schedule; it publishes any post whose
  `scheduledAt` is due.
- **Anthropic API** (optional) — AI caption generation per profile's niche/tone;
  falls back to a simple template if no key is set.
- **Vercel Blob** (optional) — lets you upload media files from the compose
  screen instead of pasting a hosted URL.

## Setup

### 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` — at minimum `DATABASE_URL` and `APP_SECRET` to run
locally. See the comments in `.env.example` for what each variable does and
where to get it.

### 2. Database

Create a free Postgres database (Supabase, Neon, or Vercel Postgres all
work) and set `DATABASE_URL`. Then run:

```bash
npm run db:migrate
```

This applies `prisma/schema.prisma` and generates the Prisma client (into
`lib/generated/prisma`, which is gitignored — it's regenerated on
`npm install` via the `postinstall` script).

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000. Create a profile (platform + niche + brand kit),
then a post. Without platform credentials configured yet, everything works
except the "Connect" button and actual publishing.

### 4. Connect TikTok

1. Create an app at https://developers.tiktok.com/apps.
2. Request the `user.info.basic` and `video.publish` scopes (Content Posting
   API). New apps are typically **unaudited**, meaning they can only post
   with `privacy_level: SELF_ONLY` (private/draft, visible only to you) —
   this is what `TIKTOK_PRIVACY_LEVEL` defaults to. Apply for the public
   posting scope when you're ready to go live.
3. Set the app's redirect URI to `<APP_URL>/api/auth/tiktok/callback`.
4. Set `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.
5. On a profile's page, click **Connect TikTok**.

### 5. Connect Facebook

1. Create an app at https://developers.facebook.com/apps with **Facebook
   Login** added.
2. Request `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`.
   These need **App Review** before they work for anyone other than admins/
   testers of the app — fine for personal use, required for anyone else.
3. Set the app's OAuth redirect URI to `<APP_URL>/api/auth/facebook/callback`.
4. Set `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.
5. On a profile's page, click **Connect Facebook**. The first Page returned
   by your account is used automatically (multi-page selection isn't built
   yet — if you manage several Pages, connect from an account/session where
   the right one comes back first).

### 6. Turn on scheduled publishing

Set `CRON_SECRET` to a random string, then pick one:

- **Vercel**: deploy the project; `vercel.json` already defines a cron
  hitting `/api/cron/publish` every 15 minutes. Vercel injects
  `Authorization: Bearer $CRON_SECRET` automatically for cron-triggered
  requests when `CRON_SECRET` is set as a project env var.
- **Anywhere else**: use `.github/workflows/publish-scheduled-posts.yml`,
  which calls the endpoint via `curl` on the same schedule. Set the
  `APP_URL` and `CRON_SECRET` repository secrets.

You can also trigger it manually any time:
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/publish`

### 7. Protect the dashboard

Set `APP_PASSWORD` and `APP_SECRET` before deploying anywhere reachable from
the internet — the app stores platform access tokens, so it shouldn't be
left open. With `APP_PASSWORD` unset, the login gate is disabled (fine for
local dev only).

### 8. AI captions (optional)

Set `ANTHROPIC_API_KEY` to enable the "Generate with AI" button on the
compose screen — it writes a caption from the profile's niche, brand tone,
and hashtags. Without a key, a simple template is used instead.

### 9. Media uploads (optional)

Create a Blob store in your Vercel project and set
`BLOB_READ_WRITE_TOKEN` to enable direct file upload from the compose
screen. Without it, paste a hosted media URL instead.

## Known limitations

- TikTok/Facebook video processing is async; if a publish is still
  processing when the cron run finishes polling, the post is left in
  `PUBLISHING` status rather than being auto-reconciled on a later run.
- Facebook Page connection auto-selects the first Page returned by the API;
  there's no in-app picker for accounts managing multiple Pages.
- Single-tenant: one shared `APP_PASSWORD` gates the whole dashboard, there's
  no per-user login.

## Development

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
npm run db:studio  # browse the database
```

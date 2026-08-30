# Skillshot Community — Vercel edition

A responsive full-stack visual showcase community built with Next.js, Neon Postgres, Vercel Blob, and Google authentication through Auth.js.

> **Show your skills. In one shot.** A Skillshot can showcase a gaming moment, coding project, website, UI/UX design, artwork, photograph, animation, creative build, discovery, or other visual work.

## Features

- Google registration and sign-in
- Verified-email profiles and protected routes
- Public community feed, creator profiles, follows, and a private My Posts page
- Global creator/Skillshot/tag search plus newest/popular sorting
- Validated PNG, JPEG, and WebP Skillshot uploads up to 10 MB
- Server-side image decoding, dimension protection, WebP optimization, thumbnails, and original-file downloads
- Profile image uploads up to 2 MB with automatic optimization
- Durable profiles, posts, reactions, and comments in Neon Postgres
- Screenshot storage and delivery through Vercel Blob
- Correctly named image downloads, likes, comments, editing, and owner-only deletion
- Owner, Admin, Moderator, Trusted Contributor, and User roles with granular server permissions
- Private staff dashboards, moderation queue, reports, appeals, audit log, analytics, and user management
- Notifications, community guidelines, reputation, and achievements (kept separate from roles)
- Server-side rate limits, content moderation hooks, and status-aware public queries
- Cursor-paginated community results, lazy-loaded thumbnails, and exactly three newest homepage Skillshots
- Safe deleted-file retention, private upload statistics, and storage-scan snapshots for administrators
- Private direct-to-Blob staging for 10 MB uploads without Vercel's 4.5 MB Function request limit
- Review-first orphan scans, retention-aware cleanup, and appeal/legal-hold protection

## Environment variables

Copy `.env.example` to `.env.local` and configure:

- `DATABASE_URL` — Neon Postgres connection string
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob store token
- `AUTH_SECRET` — long random secret
- `AUTH_GOOGLE_ID` — Google OAuth client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret
- `NEXT_PUBLIC_APP_URL` — deployed URL, such as `https://skillshot-community.vercel.app`
- `OWNER_EMAIL` — the protected Owner Google account
- `ADMIN_EMAIL` — optional initial Admin Google account
- `MODERATION_API_URL` / `MODERATION_API_KEY` — optional compatible moderation service
- `MODERATION_STRICT` — keep `true` in production (the default when unset). Unscanned Skillshots wait for staff review; unapproved avatar changes leave the existing avatar intact. Explicit `false` permits unscanned images only when no provider is configured; a configured provider failure always holds content.

Use these Google OAuth callback URLs:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google`

## Run locally

1. Install Node.js 22.13 or newer.
2. Run `pnpm install` (recommended) or `npm install`.
3. Create `.env.local` from `.env.example`.
4. Run `pnpm dev` (or `npm run dev`).
5. Open `http://localhost:3000`.

For a full beginner setup, project explanation, submission checklist, demo script, architecture, and database overview, read [`SUBMISSION_GUIDE.md`](./SUBMISSION_GUIDE.md).

The additive database tables, columns, and indexes are created automatically on the first request. Existing posts and profiles are preserved.

Read [STORAGE_OPERATIONS.md](./STORAGE_OPERATIONS.md) for upload transport, moderation configuration, storage review, cleanup, and the staging test checklist.

## Verify a release

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

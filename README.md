# Skillshot Community — Vercel edition

A responsive full-stack screenshot-sharing community built with Next.js, Neon Postgres, Vercel Blob, and Google authentication through Auth.js.

## Features

- Google registration and sign-in
- Verified-email profiles and protected routes
- Public community feed, creator profiles, follows, and a private My Posts page
- Global creator/Skillshot/tag search plus newest/popular sorting
- Validated PNG, JPEG, WebP, and GIF uploads up to 10 MB
- Durable profiles, posts, reactions, and comments in Neon Postgres
- Screenshot storage and delivery through Vercel Blob
- Correctly named image downloads, likes, comments, editing, and owner-only deletion
- Owner, Admin, Moderator, Trusted Contributor, and User roles with granular server permissions
- Private staff dashboards, moderation queue, reports, appeals, audit log, analytics, and user management
- Notifications, community guidelines, reputation, and achievements (kept separate from roles)
- Server-side rate limits, content moderation hooks, and status-aware public queries

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
- `MODERATION_STRICT` — set to `true` to hold images whenever the external scanner is unavailable

Use these Google OAuth callback URLs:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google`

## Run locally

1. Install Node.js 22.13 or newer.
2. Run `pnpm install` (recommended) or `npm install`.
3. Create `.env.local` from `.env.example`.
4. Run `pnpm dev` (or `npm run dev`).
5. Open `http://localhost:3000`.

The additive database tables, columns, and indexes are created automatically on the first request. Existing posts and profiles are preserved.

## Verify a release

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

# Skillshot Community — Vercel edition

A responsive full-stack screenshot-sharing community built with Next.js, Neon Postgres, Vercel Blob, and Google authentication through Auth.js.

## Features

- Google registration and sign-in
- Verified-email profiles and protected routes
- Public community feed plus a private My Posts page
- Search and newest/popular sorting
- Validated PNG, JPEG, WebP, and GIF uploads up to 10 MB
- Durable profiles, posts, reactions, and comments in Neon Postgres
- Screenshot storage and delivery through Vercel Blob
- Downloads, likes, comments, and owner-only comment deletion

## Environment variables

Copy `.env.example` to `.env.local` and configure:

- `DATABASE_URL` — Neon Postgres connection string
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob store token
- `AUTH_SECRET` — long random secret
- `AUTH_GOOGLE_ID` — Google OAuth client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret
- `NEXT_PUBLIC_APP_URL` — deployed URL, such as `https://skillshot-community.vercel.app`

Use these Google OAuth callback URLs:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google`

## Run locally

1. Install Node.js 22.13 or newer.
2. Run `npm install`.
3. Create `.env.local` from `.env.example`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

The database tables and indexes are created automatically on the first request.

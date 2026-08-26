# Skillshot

A responsive screenshot-sharing community built with React, Vinext/Next.js, TypeScript, Cloudflare D1, R2, and secure ChatGPT sign-in.

## Features

- Public, responsive discovery feed
- Secure hosted sign-in and protected write endpoints
- Verified-email profiles and profile editing
- Validated PNG, JPEG, WebP, and GIF uploads (10 MB limit)
- Durable D1 schema for users, posts, reactions, comments, and verification tokens
- R2 object storage for image bytes
- Image downloads with safe response headers
- Toggle reactions and owner-only comment deletion
- Accessible forms and mobile layouts

## Local setup in VS Code

1. Install Node.js 22.13 or newer and pnpm.
2. Open this folder in VS Code.
3. Run `pnpm install`.
4. Run `pnpm db:generate` whenever `db/schema.ts` changes.
5. Run `pnpm dev` and open the local URL shown in the terminal.

The local development server creates local D1 and R2 storage automatically. Hosted sign-in is completed through ChatGPT. Local public pages work without sign-in; protected actions require the hosted identity headers.

## Authentication and email verification

Skillshot deliberately does not store passwords. The hosting platform handles registration, login, password hashing, session protection, and verified-email identity. The app reads signed identity headers only on the server, protects every write endpoint, and never trusts a client-supplied user ID. This is safer than maintaining a second password database in a beginner project. The `verification_tokens` table remains available if a separate transactional-email verification flow is added later.

## Storage and security

Structured data lives in D1; uploaded bytes live in R2. Uploads are allow-listed by MIME type and capped at 10 MB. Filenames are sanitized before use in response metadata. Ownership is checked server-side for destructive actions. SQL access uses Drizzle parameterization and foreign-key cascades.

## Useful commands

- `pnpm dev` — local development
- `pnpm build` — production build
- `pnpm lint` — lint source
- `pnpm db:generate` — create SQL migrations from the schema

# Skillshot upgrade handoff

These changes are local source changes. They have not been committed, pushed, or deployed by this upgrade pass. Existing Google authentication, Neon PostgreSQL, private Vercel Blob storage, and data are retained.

## Implemented locally

- Compact homepage spacing; original artwork and visual identity retained. Exactly three newest visible homepage Skillshots remain selected in SQL.
- Natural-ratio community thumbnails, bounded feeds, and six related public Skillshots below comments.
- Debounced, database-backed search with people, skills, categories, role filters, and pagination.
- Canonical report cases, assignments, notes, escalation, versioned decisions, audit history, and protected review images. Profile hiding is separate from account suspension. Existing image retention is preserved.
- Account menu and accessible Settings & Support dialog; settings/account, notifications, appearance, privacy, security, support/contact, support/report, help, and about routes.
- Light/dark/system theme tokens, account preference persistence, local preference fallback, and an early theme bootstrap. Notification preferences are enforced at database insertion, not only in the UI.
- Trusted Contributor eligibility configuration, applications, appeals, cooldowns, staff decisions, role changes, notifications, and audits. Role approval requires authorized staff and never trusts client-supplied role fields.
- GIF validation, bounded dimensions/frame count/total decoded pixels, frame sampling across the animation, private upload processing, animated WebP display, static feed thumbnails, and original GIF downloads. Avatar uploads remain PNG/JPEG/WebP only, maximum 2 MB. Skillshot uploads remain maximum 10 MB.
- Comment likes with rollback feedback, grouped single-level replies, reply pagination, sorting, mentions resolved server-side, one pinned root comment, edited markers, deletion tombstones, and notification deduplication. Hidden-post comments are not returned publicly.

## Deliberate limitations / remaining work

- The earlier transactional-email brief is not implemented in this pass. A verified sender domain/provider is still needed for live email; no emails have been sent. Email preference switches are stored for future delivery integration, and security emails cannot be disabled.
- Account deletion currently submits a strongly confirmed support request. It does not automatically purge an account or bypass appeal/retention checks.
- Privacy is an honest description of current public visibility, not a nonfunctional private-profile toggle. Private profiles, blocking, and remote session revocation are not implemented.
- Terms and Privacy pages explicitly say policy publication is pending. They are not finalized legal documents; the site owner must provide approved content.
- Comment moderation uses the protected staff case-review workflow. Authorized staff can open Review Details or perform permission-checked Hide/Delete actions from the comment menu; every action creates or updates an audited case.
- Full signed-in browser tests, cross-device account-theme sync, provider-backed GIF moderation, live storage persistence, and end-to-end email testing remain to be performed in a configured staging environment. Sampling GIF frames reduces scanner cost but is not a guarantee that every frame is safe.
- Search mobile filters and all light/dark page combinations need a final accessibility/contrast pass.

## Verification

Latest local verification: 54 tests passed; TypeScript and production build passed; lint completed with zero errors and 15 image-element warnings. `git diff --check` passed. Live production checks are not included in these results.

Automated tests use isolated PostgreSQL (PGlite), mocked authentication/storage/scanner adapters, and real Sharp decoding. They never change production records or publish test posts.

The local homepage/navigation preview was checked at 320, 375, 390, 414, 768, 1024, 1280, 1366, 1440, 1536, and 1920 pixels wide without horizontal overflow. Settings dialog opening, mobile layout, Escape closing, and focus return were verified. Desktop card tops moved to approximately 656–683 pixels. The temporary preview route was removed before production build.

Run from this directory:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`lib/db.ts` runs additive migrations from report-case-schema, search-schema, settings-schema, trusted-schema, and comment-schema. Back up the database and rehearse migration on staging before production. Generated full-text columns may take time on a large existing database.

`NEXT_PUBLIC_GIF_MAX_FRAMES` may lower the 120-frame ceiling. GIFs also have a non-overridable 40-million total decoded-pixel ceiling. Feed thumbnails intentionally do not animate; detail previews preserve animation.

## Release procedure

1. Review the full diff, including prior uncommitted work; do not upload environment secrets.
2. Run the checks above against a configured staging environment.
3. Verify active user, non-staff, moderator, and administrator routes directly.
4. Confirm the existing database, private Blob credentials, auth configuration, and moderation provider settings in Vercel.
5. Commit the complete source update and deploy through the existing GitHub/Vercel integration.
6. Smoke-test sign-in, profile editing, PNG/GIF uploads, downloads, comments, reports, and settings after deployment.

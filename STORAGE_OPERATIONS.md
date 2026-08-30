# Image upload and storage operations

## Upload flow

Skillshots accept static PNG, JPEG, and WebP files up to **10 × 1024 × 1024 bytes**. Avatars accept the same formats up to **2 × 1024 × 1024 bytes**. The exact maximum is accepted; a single byte over is rejected.

The website requests an authenticated, rate-limited, short-lived token for one generated `staging/<UUID>.<extension>` path in the existing **private Vercel Blob store**. The browser transfers the file directly to that path, displaying real transfer progress. It then sends only the path and post fields to `POST /api/posts`. This avoids the [Vercel Function body-size limit](https://vercel.com/docs/vercel-blob/client-upload), without exposing the store's read/write token.

The server checks ownership and expiry of the upload session, atomically claims it, reads no more than 10 MB, compares declared MIME with decoded image content, enforces dimensions/pixel limits, moderates a bounded decoded preview, and generates display/thumbnail variants. The post, moderation queue entry, and completion marker are committed together. Original downloads retain the original PNG/JPEG/WebP format and extension; browsing uses WebP variants.

The multipart route remains compatible with older clients, but those clients are still subject to their host's request-size cap. The current website uses direct private staging for all Skillshots. No upload-completion webhook or local tunnel is required.

Originals are retained for download fidelity. Display images fit within 2400×2400; thumbnails fit within 960×720. Decoding is capped at 40 million pixels and 12,000 pixels per axis. Animated files are not accepted. Avatars are cropped/optimized once on the server to 512×512, with a 20-million-pixel/8,000-per-axis input cap. Client previews do not re-encode avatars.

Post creation allows 8 attempts/hour per account; token generation separately allows 8/hour. Avatar changes allow 12/day. Failed operations are recorded without revealing raw provider errors.

## Moderation

For the built-in OpenAI option, follow [moderation setup](MODERATION_SETUP.md) and configure `MODERATION_PROVIDER=openai` plus `OPENAI_API_KEY`. For a custom service, set `MODERATION_PROVIDER=custom`, `MODERATION_API_URL`, and `MODERATION_API_KEY`. A custom service must accept authenticated JSON:

- Text: `{ "type": "text", "text": "..." }`
- Image: `{ "type": "image", "url": "data:image/webp;base64,..." }`
- Response: `{ "level": "SAFE" | "BORDERLINE" | "HIGH", "category"?: "...", "providerRef"?: "..." }`

The image value is a bounded, decoded preview, not an inaccessible private Blob URL. Internal decisions and provider references are not returned to normal users. Requests time out after 15 seconds. Invalid responses or configured-provider failures are held for human review. High-risk Skillshots are blocked. Unapproved avatar changes are rejected without replacing the existing image.

**Keep `MODERATION_STRICT=true` in production.** An OpenAI adapter is included, but no service account or key is provisioned by this code change. Without a configured service, Skillshots will wait for staff review and avatars cannot be approved automatically. Do not describe fallback keyword checks as a complete image moderation service.

## Storage dashboard and cleanup

Owners/Admins use `/admin/storage`. Backend role and permission checks protect its API independently of the UI.

- Upload activity/failure counts come from the database.
- A complete storage scan records actual bytes in the `shots/`, `avatars/`, and `staging/` namespaces. The dashboard labels this as the latest complete scan, not a continuously refreshed provider total.
- Before a scan, the byte counter is explicitly labelled database-tracked image bytes. It is not a billing total; it can exclude old, unreferenced files.
- Scans are rate-limited and capped at 5,000 files per namespace. Incomplete scans do not infer missing files or resolve previous findings. Larger stores need a paginated/background audit job.
- Recent files (less than an hour old) are not marked as orphaned, to avoid racing in-flight uploads.
- Orphan findings are shown for review, never automatically deleted. Reviewing an unreferenced file queues it for another 7 days before deletion. Missing-file findings do not cause deletion.
- Deleted Skillshots retain their files for 30 days; replaced avatars retain them for 7 days. Failed rollback files enter the review queue.
- Every file for a deleted post must be reviewed and past retention before group cleanup. Active references, pending moderation, appeals, or a legal hold prevent cleanup.
- Posts enter `PURGING` before Blob deletion and `PURGED` after successful cleanup. Restore and appeal routes cannot revive a post that crossed the purge boundary. If storage deletion fails, leave `PURGING` intact and retry from the queue—some files may already have been deleted.
- Set `posts.legal_hold=true` through controlled database administration for external/legal retention. This is distinct from the application's automatic `appeal_hold`; resolving an appeal does not clear a legal hold. Coordinate legal-hold changes before authorizing purge.
- Successful reviews, scans, and deletions are written to the audit log.

No production scan, deletion, database migration, or deployment was performed as part of local verification. Existing legacy posts remain readable; if they lack generated variants, the image route falls back to their existing image. A controlled derivative backfill is needed before claiming every legacy image has a thumbnail.

## Release verification

Automated tests cover exact/over-limit sizes, valid padded 1/2 MB avatars and 5/10 MB Skillshots, invalid bytes, MIME mismatches, extreme dimensions, bounded streams, variant dimensions, original download type selection, cursor bounds, staging/cleanup path safety, storage permission defaults, and moderation provider failures.

Local component fixtures verified image selection, preview, oversized/type errors, and no horizontal overflow at 375, 390, 768, 1024, and 1440 pixels. Fixtures were synthetic and removed before release. Anonymous requests to upload-token, publish, and storage-admin APIs returned 401.

Before production rollout, use a **staging database/private Blob store** and complete these integration checks (not claimed as locally verified):

1. Google sign-in; valid 1/2 MB avatar save; refresh and confirm persistence; reject >2 MB.
2. Valid 5/10 MB direct Skillshot upload; verify progress and all three private assets; reject >10 MB.
3. Cross-account staging path theft, duplicate finalization, expired tokens, and token replay attempts.
4. Slow/offline network and storage-provider failure; ensure no published post references missing files.
5. SAFE, BORDERLINE, HIGH, unavailable, and malformed moderation responses.
6. Verify homepage database query returns only the 3 newest visible posts; paginate a feed with >18 records and timestamp ties.
7. Verify thumbnails in home/feed/search/featured-profile surfaces, original download headers, and conditional image revalidation after hiding a post.
8. Delete a synthetic post; verify retention, review requirements, pending-appeal/legal-hold blocks, restoration before purge, and safe retry after partial purge.
9. Scan a known orphan and a missing referenced file; confirm review-first behavior. Check actual byte totals against the provider.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` before publishing. Never include `.env.local`, production credentials, real user images, or database exports in the source package.

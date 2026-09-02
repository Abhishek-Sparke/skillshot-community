# Staff dashboard rework

## Scope

This upgrade reuses the existing Next.js application, authentication, Neon database, private Blob images, roles and action APIs. It does not redesign public pages or require a new database/provider. Staff-only styling lives in `app/staff.css`.

- Shared sticky desktop navigation, permission-aware groups, mobile drawer, breadcrumbs, profile and notification links.
- Database-backed overview counts and quick actions. Storage counts are tracked references, not an invented live provider total.
- Moderation previews for Skillshots, comments and current saved profiles; automatic flags and community reports; server-side filtering and 20-item pages.
- Detail dialogs with up to 10 recent reports and moderation actions; explicit delete confirmation; keyboard dismissal and focus restoration.
- Responsive staff table, focused role-management dialog, existing role badges and permission-gated user controls.
- Audit search by action, actor, target and UTC date with 30-item pages. Missing historical reasons/previous values are labeled as not recorded rather than fabricated.
- Storage breakdowns for originals, display variants, thumbnails and avatars. Existing reviewed cleanup, retention and appeal protections remain unchanged.

## Permission boundaries

The existing role hierarchy and mutation authorization remain authoritative. Navigation and available actions mirror that hierarchy; hiding UI is never the authorization mechanism. Staff layouts also reject inactive accounts. Trusted Contributors and normal users have no staff workspace.

Owner/Admin staff can see only links with the relevant permission. Admin Settings requires `settings.manage`. Head Moderators manage Moderators only; their team query omits Admin/Owner accounts. Head Moderator history without `audit.view` shows **only their own moderation actions**. Moderators receive history only with explicit `audit.view`. New moderation reads omit provider references/model scores and restrict reporter details to report viewers.

## Existing workflow limitations (not silently changed)

- The existing moderation PATCH endpoint does not support PROFILE actions. Profile cards show this and link authorized administrators to user management. This UI-only change does not add profile approval/deletion powers or auto-resolve those flags.
- Rejected avatar replacement files are not retained by the current upload system. Profile previews show the current saved profile, not the rejected replacement.
- Images and Skillshots are the same visual-upload records in the existing data model, so those filters intentionally overlap.
- The queue is a flagged-content workspace, not an inventory of every unflagged post/comment.
- Settings remains a read-only display of server policy; it does not add a configuration-writing API.

## Verification

- Unit tests cover navigation, custom permissions, action visibility, bounded filters and all previous upload/authentication tests.
- `tests/staff-api.test.mjs` executes actual API-handler source with isolated authentication/database adapters. It tests non-staff denial, forbidden/self/peer role changes, forbidden Skillshot deletion, profile-action rejection, actor-scoped history and database filter parameters. It does not connect to a live database.
- Local HTTP requests without a session returned 401 for staff overview/moderation/audit/team/users GETs and moderation/team/users/appeals PATCHs and storage POST. Staff navigation redirected to sign-in.
- Browser checks used explicitly labeled temporary fixture data and the real UI components. Overview, moderation, team, storage, audit and detail-dialog layouts were checked at 375, 390, 768, 1024 and 1440px with no horizontal overflow. Long usernames, comments, reasons and storage paths were included. Mobile drawer navigation, Escape/focus restoration, canceling deletion and empty states were checked. Temporary preview routes were removed before the production build.
- No production roles, posts, reports or storage files were mutated during verification.

Before publishing, run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`. After deploying to a staging environment, verify real database filtering and image previews with staff accounts, then test permitted mutations using disposable records. Live authenticated database/provider workflows have not been exercised by the local fixture tests.

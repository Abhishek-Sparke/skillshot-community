# Skillshot Community — Project Report and Submission Guide

## 1. Project statement

**Project title:** Skillshot Community — Show Your Skills in One Shot

**Statement:**

Skillshot is a full-stack visual showcase and social community where people can present something they created, built, captured, designed, discovered, or are proud of. A Skillshot is not limited to a normal screenshot. It can represent a gaming moment, coding project, website, UI/UX design, digital artwork, photograph, animation, creative build, or another form of visual work. Users sign in securely with Google, build a professional profile, publish optimized images, discover other creators, follow people, react to posts, comment, search, and download original images. Staff roles provide moderation, reporting, user management, audit, analytics, and storage monitoring tools.

**Core message:** “Show your skills. In one shot.”

## 2. Problem and solution

Many platforms either store images without useful creator context or focus on only one category such as photography, design, or gaming. Skillshot provides one clean community for many kinds of visual work while connecting every post to the creator’s profile, skills, followers, reactions, comments, and category.

The system also solves practical production problems: unsafe file uploads, oversized images, fake MIME types, excessive dimensions, slow feeds, unauthorized actions, spam, moderation, and uncontrolled storage growth.

## 3. Main objectives

- Give creators a simple place to showcase visual work.
- Support secure Google authentication and protected pages.
- Provide professional profiles, follows, posts, likes, comments, search, and downloads.
- Validate and optimize uploaded images without unnecessarily reducing quality.
- Load thumbnails efficiently on mobile and desktop.
- Provide role-based staff and moderation tools.
- Keep the application easy to run locally and deploy on Vercel.

## 4. Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React with Next.js App Router | Pages, components, responsive interface, server rendering |
| Backend | Next.js route handlers | Authentication-aware APIs and business rules |
| Language | TypeScript | Safer application code and types |
| Authentication | Auth.js / NextAuth with Google OAuth | Google login and protected sessions |
| Database | Neon PostgreSQL | Users, profiles, posts, follows, reactions, comments, roles, reports, and statistics |
| Image storage | Private Vercel Blob | Original images, display images, thumbnails, and avatars |
| Image processing | Sharp | Decoding, dimensions, resizing, WebP conversion, and thumbnails |
| Hosting | Vercel | Production builds and deployment |
| Styling | Responsive CSS | Mobile, tablet, and desktop layouts |
| Testing | Node test runner, TypeScript, ESLint, Next.js build | Automated verification |

## 5. How Skillshot works from zero

### Step 1: Sign in

The visitor chooses Google sign-in. Google verifies the account and returns the user to Skillshot through the Auth.js callback. On the first authenticated request, Skillshot creates the user record if it does not already exist. Protected routes and server APIs verify the session again; the interface alone is never trusted for authorization.

### Step 2: Complete the profile

The user selects a unique username and adds a display name, bio, location, skills, website, social links, and optional profile picture. Avatar uploads allow PNG, JPG/JPEG, or WebP with a maximum input size of 2 MB. The server decodes the real image, rejects invalid content, produces a sharp 512 × 512 WebP avatar, updates the database, and removes the replaced avatar only after the new profile saves successfully.

### Step 3: Create a Skillshot

The Create page asks what the user is sharing. The user selects a PNG, JPG/JPEG, or WebP image up to 10 MB, then enters:

- Title
- Description
- Skills
- Tags
- Optional category

The page provides a live card preview, upload percentage, optimization status, completion feedback, and readable errors.

### Step 4: Secure image pipeline

The backend performs this sequence:

1. Check authentication.
2. Apply the upload rate limit.
3. Enforce the 10 MB maximum.
4. Check the declared MIME type.
5. Decode the actual image instead of trusting its extension.
6. Reject unsupported formats, corrupt files, huge dimensions, or decompression-risk images.
7. Moderate the text and image.
8. Preserve the original file for downloads and retention needs.
9. Generate an optimized display WebP image.
10. Generate a smaller WebP thumbnail for feeds and search.
11. Save private Blob paths and metadata in PostgreSQL.
12. Publish safe content or send borderline content to the moderation queue.

### Step 5: Community discovery

Visible Skillshots appear in newest-first order. The homepage requests exactly the three newest visible posts directly from PostgreSQL. The full Community page requests a limited page and uses a cursor to load more instead of loading the complete database. Feed, profile, and search cards use lazy-loaded thumbnails. The detail page uses the larger display image, while Download returns the original image with the correct filename and file type.

### Step 6: Social interaction

Users can follow other creators, react to Skillshots, add or edit their own comments, and delete comments when authorized. Public profile pages display work, featured Skillshots, follower/following counts, skills, social links, and achievements. My Posts shows the signed-in creator’s own work.

### Step 7: Moderation and administration

Roles include Owner, Admin, Head Moderator, Moderator, Trusted Contributor, and User. Server permissions control every sensitive staff API. Depending on permission, staff can review reports and automatically held content, moderate Skillshots and comments, manage users and roles, review appeals, inspect audit logs, view analytics, and see live storage totals.

When a Skillshot is deleted, it disappears immediately but its Blob paths enter a 30-day cleanup review queue. This supports moderation or appeal needs and avoids unsafe immediate destruction. Administrators can review storage totals, failed uploads, held uploads, and queued cleanup records.

## 6. Main database entities

- `users`: account, profile, status, role, permissions, avatar metadata
- `posts`: Skillshot text, category, skills, tags, original/display/thumbnail paths, sizes, dimensions, moderation state
- `reactions`: one reaction per user and post
- `comments`: comments and visibility state
- `follows`: follower and followed-user relationships
- `featured_posts`: up to three selected profile Skillshots
- `reports`: user reports against content
- `moderation_queue`: automatic and reported review items
- `appeals`: user appeals against decisions
- `notifications`: user and staff notifications
- `audit_logs`: sensitive staff-action history
- `rate_limits`: server-enforced request limits
- `upload_events`: successful, held, blocked, and failed upload statistics
- `storage_cleanup_queue`: retained files awaiting reviewed cleanup

Database initialization is additive. The application creates missing tables, columns, and indexes on its first database-backed request without deleting existing data.

## 7. Security features

- Google OAuth rather than custom password storage
- Protected pages and server-side session checks
- Role and permission checks on sensitive APIs
- Private image storage
- PNG/JPEG/WebP allowlist
- File-size enforcement on frontend and backend
- Real image decoding and format validation
- Dimension and pixel-count limits
- Upload and avatar-change rate limits
- Text and image moderation pipeline
- Parameterized PostgreSQL queries
- Safe URL normalization for profile and social links
- Owner/staff authorization for content deletion
- Soft deletion and reviewed storage cleanup
- No raw backend errors exposed to normal users

## 8. Run the project in VS Code

### Requirements

- Visual Studio Code
- Node.js 22.13 or newer
- pnpm, or npm
- Neon PostgreSQL database
- Vercel Blob store
- Google Cloud OAuth client

### Setup

1. Extract the ZIP package.
2. Open the extracted `skillshot-community` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Install dependencies:

   ```bash
   npm install
   ```

   Or, when pnpm is installed:

   ```bash
   pnpm install
   ```

5. Copy `.env.example` to a new file named `.env.local`.
6. Replace every example value with your own credentials.
7. Configure Google OAuth callbacks:

   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://YOUR-DOMAIN/api/auth/callback/google`

8. Start the development server:

   ```bash
   npm run dev
   ```

9. Open `http://localhost:3000`.

The first database-backed request runs the safe additive database initialization.

## 9. Required environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob token |
| `AUTH_SECRET` | Long random session-signing secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | Local or production application URL |
| `OWNER_EMAIL` | Google email that receives the protected Owner role |
| `ADMIN_EMAIL` | Optional initial Admin email |
| `MODERATION_API_URL` | Optional external moderation service URL |
| `MODERATION_API_KEY` | Optional external moderation service key |
| `MODERATION_STRICT` | `true` to hold images when scanning is unavailable |

Never submit `.env.local`, database passwords, Blob tokens, OAuth secrets, or moderation keys. Only submit `.env.example` with placeholder values.

## 10. Generate an authentication secret

PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

OpenSSL:

```bash
openssl rand -base64 32
```

## 11. Verify before submission

Run these commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected result: no TypeScript errors, no lint errors, all tests pass, and the production build completes.

Also test manually:

- Google sign-in and sign-out
- Profile save and avatar persistence
- Valid and invalid image uploads
- Files above the avatar and Skillshot limits
- Create-page preview and progress feedback
- Community, search, profile, and My Posts
- Reactions, comments, follows, and original download
- Owner/admin dashboard access
- Mobile widths such as 375 px and 390 px

## 12. What to submit

Submit one ZIP containing the source code and documentation. It should include:

- `app/`
- `lib/`
- `public/`
- `tests/`
- `.env.example`
- `README.md`
- `SUBMISSION_GUIDE.md`
- `package.json`
- `pnpm-lock.yaml`
- Next.js, TypeScript, ESLint, and PostCSS configuration files

Do not include:

- `.env.local`
- `node_modules/`
- `.next/`
- `.git/`
- passwords, client secrets, private tokens, or database credentials

Optional supporting items:

- Live site URL
- GitHub repository URL
- Screenshots of the homepage, create page, profile, community, and admin dashboard
- A short screen-recorded demonstration
- Database entity-relationship diagram if required by your institution

## 13. Suggested demonstration order

1. Explain the statement: “Show your skills. In one shot.”
2. Show the homepage and its three newest Skillshots.
3. Sign in with Google.
4. Open and edit the professional profile.
5. Create a Skillshot and explain its live preview and upload pipeline.
6. Open Community and demonstrate discovery, search, and pagination.
7. Open a Skillshot to react, comment, preview, and download the original.
8. Follow another creator and show follower counts.
9. Sign in with an authorized staff account and demonstrate moderation and storage statistics.
10. Finish with security, responsive design, testing, and future improvements.

## 14. Short presentation script

“Skillshot is a full-stack visual showcase community built around the message ‘Show your skills. In one shot.’ It allows creators from gaming, development, design, art, photography, and other fields to publish visual work and connect it to a professional profile. The application uses Next.js and TypeScript for the interface and APIs, Google OAuth for secure sign-in, Neon PostgreSQL for relational data, and private Vercel Blob storage for images. Every upload is validated on the server, decoded, protected against extreme dimensions, moderated, optimized into display and thumbnail versions, and stored with its original file for correct downloads. The community uses database-side limits, cursor pagination, and lazy thumbnails for performance. Role-based dashboards support moderation, reports, analytics, user management, auditing, and storage monitoring. The project is responsive, tested, and deployed on Vercel.”

## 15. Limitations and future improvements

- Add a production image-moderation provider when required.
- Add reviewed automatic execution for expired cleanup records.
- Add video and animation transcoding as a separate, controlled pipeline.
- Add email or push notifications.
- Add richer creator analytics and recommendations.
- Add automated end-to-end browser tests in CI.
- Add database migration tooling for larger teams and production release history.

## 16. Project links

- Live site: https://skillshot-community.vercel.app
- Repository: https://github.com/Abhishek-Sparke/skillshot-community

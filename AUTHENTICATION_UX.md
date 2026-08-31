# Sign in, sign up, and log out

## What changed

- Guest navigation now includes both **Sign in** and **Sign up**, on desktop and in the mobile menu.
- `/signin` and `/signup` share one clean account-access layout with a Google button, clear headings, links between the two pages, feedback, and home/community links.
- Both use the existing Google authentication system. This is not a new email/password authentication implementation. The existing profile initialization creates the user's Skillshot account after the first Google sign-in; returning Google users retain their existing account and posts.
- Sign up from the navbar defaults to profile setup. Switching between auth pages preserves a requested destination such as `/upload`.
- Signed-in visitors to an auth page are redirected instead of seeing another login prompt.
- **Log out** is a POST-based Auth.js server action in the public navbar. It is available in both desktop and mobile menus, includes a pending state, and returns the user home. The old Edit Profile sign-out link has been removed.
- The navbar's content-width measurement includes the logout form, so staff users' longer menus collapse when necessary.
- Return paths reject external URLs, raw backslashes, and control characters. Auth-page self-redirects fall back to home.

No database migration, new dependency, OAuth configuration change, or new environment variable is required.

## Validation

Type checking and production build passed. All 27 automated tests passed, including isolated tests of the actual auth page/provider actions, logout visibility/action, role menus, and return paths. Real Google login/logout was not performed against a live account, and the new pages have not yet been visually checked on devices.

Before release, check logged-out Sign in/Sign up links, Google completion/cancellation, account persistence, signup profile setup, destination preservation, and logout followed by a protected-route visit. Check the navbar and auth pages at 320, 375, 390, 414, 768, 1024, 1280, and 1440px. Do not log another user out just to test the button without their approval.

## Publish

Apply the complete update contents to the existing repository root, preserving `app`, `lib`, and `tests` paths. Commit the update and let the connected Vercel project build it. Do not upload the ZIP itself as application source, and do not upload `.env` files or credentials. The production website will not show this update until deployment succeeds.

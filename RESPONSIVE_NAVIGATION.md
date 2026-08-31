# Responsive public navigation

The public header uses one link list and one reusable `ResponsiveNavbar`. The server wrapper `PublicNavbar` gets the authenticated viewer and builds links using `publicNavigation`. The viewed creator's role is never used to grant a Dashboard link. Existing dashboard/page/API authorization is unchanged.

The header measures the natural width of its actual links plus the logo, gap, and container padding. A ResizeObserver responds to changes in available container width; font-loading changes also trigger measurement. Mobile layout therefore depends on available room and menu contents, not just a viewport breakpoint.

The dropdown sits outside normal document flow. It closes on link activation, outside pointer interaction, Escape, or keyboard focus leaving the header. Escape returns focus to the toggle. Closed links are inert. Touch targets are at least 44px; reduced-motion preferences disable transitions.

Integrated pages: home, community, search, my posts, own/public creator profiles, shot detail, and notifications. The simpler sign-in/upload/edit-profile task headers and staff dashboard shell are unchanged.

## Verification before publishing

Local validation: type checking passed; all 23 tests passed; production build passed; lint completed with zero errors and 11 pre-existing image-element warnings. No temporary visual-test route is included in the production build.

Automated role-menu coverage is in `tests/core.test.ts`. Browser-based visual checks could not run in this environment because its URL policy blocked the local preview. Do not treat the following as completed tests:

1. Open the site as a guest, active member, and authorized staff user at 320, 375, 390, 414, 768, 1024, 1280, and 1440px.
2. Check there is no horizontal scroll, clipped logo, overlapping links, or unusably narrow control. Full navigation should appear whenever there is enough room; wider staff menus should collapse earlier.
3. Check guest mobile navigation is Community, Search, Sign in. Members see My posts, Profile, and Share a shot. Only active staff see Dashboard, linked to their existing role-specific panel.
4. Open/close the menu and confirm the header and page content stay in place. Check long pages, landscape/short viewports, and enlarged text.
5. Check navigation closes the menu, clicking outside closes it, Escape closes it and focuses the toggle, and Tab can reach all visible links but no closed links.
6. Resize while the menu is open, including narrowing a container independently of viewport width; confirm it returns cleanly to the full desktop navigation.
7. Check reduced-motion settings and direct access to protected dashboard routes using an unauthorized account.

No database migration, new dependency, or environment variable is required. These local changes must be committed/uploaded and deployed before they appear on the production site.

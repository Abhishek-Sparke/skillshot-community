import PublicNavbar from '../components/public-navbar';
import SideIconRail from '../components/side-icon-rail';
import CommunityPageView from '../components/community-page-view';
import { getPrincipal } from '../../lib/authz';
import { isStaffRole } from '../../lib/roles';
import type { CreatorRankId } from '../../lib/creator-rank';

export const dynamic = 'force-dynamic';

export default async function CommunityPage() {
  const principal = await getPrincipal();

  const currentUser = principal ? {
    id: principal.id,
    username: String(principal.profile.username || ''),
    displayName: String(principal.profile.display_name || ''),
    role: principal.role,
    avatarUrl: principal.profile.avatar_url ? `/api/avatars/${encodeURIComponent(String(principal.profile.username))}?v=${encodeURIComponent(String(principal.profile.avatar_url))}` : undefined,
    creatorRank: (principal.profile.creator_rank as CreatorRankId) || 'NEWCOMER',
    isStaff: isStaffRole(principal.role),
  } : null;

  return (
    <main style={{ position: 'relative', overflowX: 'clip' }}>
      <PublicNavbar returnTo="/community" />
      {/* Infinite Side Visual Animation Rails */}
      <SideIconRail side="left" />
      <SideIconRail side="right" />

      <CommunityPageView currentUser={currentUser} />
    </main>
  );
}

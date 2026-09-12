import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PublicNavbar from '../../components/public-navbar';
import DiscussionDetailView from '../../components/discussion-detail-view';
import { getPrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { isStaffRole, normalizeRole } from '../../../lib/roles';
import type { CreatorRankId } from '../../../lib/creator-rank';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT title, summary, content FROM discussions WHERE id = $1 AND status = 'VISIBLE' LIMIT 1`, [id]);
  if (!rows.length) {
    return {
      title: 'Discussion Not Found — Skillshot',
    };
  }
  const r = rows[0];
  const title = String(r.title);
  const description = String(r.summary || r.content).slice(0, 160);
  return {
    title: `${title} — Skillshot Discussion`,
    description,
  };
}

export default async function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [principal, sql] = await Promise.all([getPrincipal(), getReadyDb()]);
  const viewerId = principal?.id ?? null;
  const isStaff = Boolean(principal && isStaffRole(principal.role));

  const rows = await sql.query(`
    SELECT d.id, d.user_id, d.title, d.summary, d.content, d.category,
      d.image_url, d.image_type, d.is_gif, d.is_announcement, d.is_pinned, d.is_locked,
      d.reaction_count, d.reply_count, d.created_at, d.updated_at,
      u.display_name, u.username, u.role, u.avatar_url, u.creator_rank,
      EXISTS(SELECT 1 FROM discussion_reactions dr WHERE dr.discussion_id = d.id AND dr.user_id = $2) AS viewer_reacted,
      EXISTS(SELECT 1 FROM saved_discussions sd WHERE sd.discussion_id = d.id AND sd.user_id = $2) AS viewer_saved
    FROM discussions d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = $1 AND (d.status = 'VISIBLE' OR $3 = true)
    LIMIT 1
  `, [id, viewerId ?? '', isStaff]);

  if (!rows.length) {
    notFound();
  }

  const r = rows[0];

  const repliesRows = await sql.query(`
    SELECT dr.id, dr.body, dr.created_at, dr.user_id,
      u.display_name, u.username, u.role, u.avatar_url, u.creator_rank
    FROM discussion_replies dr
    JOIN users u ON u.id = dr.user_id
    WHERE dr.discussion_id = $1 AND dr.status = 'VISIBLE'
    ORDER BY dr.created_at ASC
  `, [id]);

  const discussion = {
    id: String(r.id),
    userId: String(r.user_id),
    title: String(r.title),
    summary: String(r.summary || ''),
    content: String(r.content),
    category: String(r.category || 'General'),
    imageUrl: r.image_url ? `/api/discussions/${encodeURIComponent(String(r.id))}/image` : null,
    imageType: r.image_type ? String(r.image_type) : null,
    isGif: Boolean(r.is_gif),
    isAnnouncement: Boolean(r.is_announcement),
    isPinned: Boolean(r.is_pinned),
    isLocked: Boolean(r.is_locked),
    reactionCount: Number(r.reaction_count || 0),
    replyCount: Number(r.reply_count || 0),
    createdAt: new Date(r.created_at as string).getTime(),
    updatedAt: new Date(r.updated_at as string).getTime(),
    author: {
      displayName: String(r.display_name),
      username: String(r.username),
      role: normalizeRole(r.role),
      avatarUrl: r.avatar_url ? `/api/avatars/${encodeURIComponent(String(r.username))}?v=${encodeURIComponent(String(r.avatar_url))}` : '',
      creatorRank: (r.creator_rank as CreatorRankId) || 'NEWCOMER',
    },
    viewerReacted: Boolean(r.viewer_reacted),
    viewerSaved: Boolean(r.viewer_saved),
    isOwner: Boolean(viewerId && viewerId === r.user_id),
  };

  const replies = repliesRows.map((rep: Record<string, unknown>) => ({
    id: String(rep.id),
    body: String(rep.body),
    createdAt: new Date(rep.created_at as string).getTime(),
    author: {
      displayName: String(rep.display_name),
      username: String(rep.username),
      role: normalizeRole(rep.role),
      avatarUrl: rep.avatar_url ? `/api/avatars/${encodeURIComponent(String(rep.username))}?v=${encodeURIComponent(String(rep.avatar_url))}` : '',
      creatorRank: (rep.creator_rank as CreatorRankId) || 'NEWCOMER',
    },
    isOwner: Boolean(viewerId && viewerId === rep.user_id),
  }));

  const currentUser = principal ? {
    id: principal.id,
    username: String(principal.profile.username || ''),
    displayName: String(principal.profile.display_name || ''),
    role: principal.role,
    avatarUrl: principal.profile.avatar_url ? `/api/avatars/${encodeURIComponent(String(principal.profile.username))}?v=${encodeURIComponent(String(principal.profile.avatar_url))}` : '',
    creatorRank: (principal.profile.creator_rank as CreatorRankId) || 'NEWCOMER',
    isStaff: isStaffRole(principal.role),
  } : null;

  return (
    <main style={{ position: 'relative', overflowX: 'clip', minHeight: '100vh', background: 'var(--bg)' }}>
      <PublicNavbar returnTo={`/discussion/${encodeURIComponent(id)}`} />
      <DiscussionDetailView
        initialDiscussion={discussion}
        initialReplies={replies}
        currentUser={currentUser}
      />
    </main>
  );
}

import CreatorProfile from '../../components/creator-profile';
import type { Metadata } from 'next';
import { getReadyDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const rows = await (await getReadyDb()).query(`
    SELECT u.display_name,u.bio,
      (SELECT fp.post_id FROM featured_posts fp WHERE fp.user_id=u.id ORDER BY fp.position LIMIT 1) AS featured_id
    FROM users u WHERE lower(u.username)=lower($1) LIMIT 1
  `, [username]);
  if (!rows.length) return { title: 'Creator not found — Skillshot' };
  const name = String(rows[0].display_name);
  const description = String(rows[0].bio || `See ${name}'s work and Skillshots on Skillshot.`).slice(0, 160);
  const images = rows[0].featured_id ? [`/api/images/${rows[0].featured_id}`] : ['/og.png'];
  return {
    title: `${name} — Skillshot`, description,
    alternates: { canonical: `/users/${encodeURIComponent(username)}` },
    openGraph: { title: `${name} — Skillshot`, description, images, type: 'profile' },
    twitter: { card: 'summary_large_image', title: `${name} — Skillshot`, description, images },
  };
}

export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <CreatorProfile username={username} />;
}

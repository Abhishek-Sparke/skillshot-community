import type { Metadata } from 'next';
import ShotDetail from '../../components/shot-detail';
import PublicNavbar from '../../components/public-navbar';
import { Suspense } from 'react';
import RelatedSkillshots from '../../components/related-skillshots';
import { getReadyDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const sql = await getReadyDb();
    const rows = await sql.query(`
      SELECT p.title, p.description, p.category, p.image_width, p.image_height, u.display_name, u.username
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND p.status = 'VISIBLE' AND u.status = 'ACTIVE' LIMIT 1
    `, [id]);
    if (!rows.length) {
      return {
        title: 'Skillshot Not Found | Skillshot Community',
        description: 'The requested Skillshot could not be found or has been removed.',
      };
    }
    const row = rows[0];
    const title = `${row.title} by ${row.display_name} (@${row.username})`;
    const description = String(row.description || `Explore "${row.title}" by ${row.display_name} in ${row.category} on Skillshot Community.`);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skillshot-community.vercel.app';
    const imageUrl = `${appUrl}/api/images/${encodeURIComponent(id)}?variant=display`;
    const shotUrl = `${appUrl}/shots/${encodeURIComponent(id)}`;

    return {
      title: `${title} | Skillshot`,
      description,
      openGraph: {
        title,
        description,
        url: shotUrl,
        siteName: 'Skillshot Community',
        type: 'article',
        images: [
          {
            url: imageUrl,
            width: Number(row.image_width) || 1200,
            height: Number(row.image_height) || 630,
            alt: String(row.title),
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: 'Skillshot | Show your skills. In one shot.',
    };
  }
}

export default async function ShotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><PublicNavbar returnTo={`/shots/${encodeURIComponent(id)}`}/><ShotDetail key={id} id={id} /><Suspense fallback={null}><RelatedSkillshots id={id}/></Suspense></>;
}

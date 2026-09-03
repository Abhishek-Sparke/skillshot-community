import ShotDetail from '../../components/shot-detail';
import PublicNavbar from '../../components/public-navbar';
import { Suspense } from 'react';
import RelatedSkillshots from '../../components/related-skillshots';

export const dynamic = 'force-dynamic';

export default async function ShotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><PublicNavbar returnTo={`/shots/${encodeURIComponent(id)}`}/><ShotDetail key={id} id={id} /><Suspense fallback={null}><RelatedSkillshots id={id}/></Suspense></>;
}

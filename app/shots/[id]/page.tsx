import ShotDetail from '../../components/shot-detail';
import PublicNavbar from '../../components/public-navbar';

export const dynamic = 'force-dynamic';

export default async function ShotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><PublicNavbar returnTo={`/shots/${encodeURIComponent(id)}`}/><ShotDetail id={id} /></>;
}

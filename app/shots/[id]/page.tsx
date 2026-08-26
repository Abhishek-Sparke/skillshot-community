import ShotDetail from '../../components/shot-detail';

export const dynamic = 'force-dynamic';

export default async function ShotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShotDetail id={id} />;
}

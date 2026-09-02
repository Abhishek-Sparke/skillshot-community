import Link from 'next/link';
import { requirePanel } from '../../../lib/authz';

export default async function Page(){
  const principal=await requirePanel('admin');
  if(!principal.permissions.includes('settings.manage'))return <div><h1>Settings unavailable</h1><p>Only the Owner can manage platform settings.</p><Link href="/admin">Back to dashboard</Link></div>;
  return <div><section className="staffSection"><div className="metricRow"><span>Profile image maximum</span><b>2 MB</b></div><div className="metricRow"><span>Visible homepage Skillshots</span><b>3 newest</b></div><div className="metricRow"><span>Borderline uploads</span><b>Human review</b></div><div className="metricRow"><span>High-confidence violations</span><b>Held</b></div></section></div>;
}

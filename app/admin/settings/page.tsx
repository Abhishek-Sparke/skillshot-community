import Link from 'next/link';
import { requirePanel } from '../../../lib/authz';

export default async function Page(){
  const principal=await requirePanel('admin');
  if(!principal.permissions.includes('settings.manage'))return <main className="staffPage shell"><h1>Settings unavailable</h1><p>Only the Owner can manage platform settings.</p><Link href="/admin">Back to dashboard</Link></main>;
  return <main className="staffPage shell"><nav className="staffNav"><Link className="brand" href="/"><span>S</span> Skillshot</Link><Link href="/admin">Dashboard</Link></nav><header><p className="eyebrow">PLATFORM SETTINGS</p><h1>Safety and publishing policy.</h1><p>These production safeguards are enforced by the server and deployment configuration.</p></header><section className="staffSection"><div className="metricRow"><span>Profile image maximum</span><b>2 MB</b></div><div className="metricRow"><span>Visible homepage Skillshots</span><b>3 newest</b></div><div className="metricRow"><span>Borderline uploads</span><b>Human review</b></div><div className="metricRow"><span>High-confidence violations</span><b>Held</b></div></section></main>;
}

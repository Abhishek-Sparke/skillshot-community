import { requirePanel } from '../../lib/authz';
import StaffPanel from './staff-panel';

type PanelKind = 'admin' | 'head-mod' | 'mod';
type Focus = 'all' | 'moderation' | 'reports' | 'skillshots' | 'comments' | 'trusted';

export default async function StaffRoute({ kind, title, focus = 'all' }: { kind: PanelKind; title: string; focus?: Focus }) {
  await requirePanel(kind);
  return <StaffPanel title={title} focus={focus}/>;
}

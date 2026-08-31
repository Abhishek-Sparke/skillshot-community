import { requirePanel } from '../../lib/authz';
import StaffPanel from './staff-panel';
import type { Permission } from '../../lib/roles';

type PanelKind = 'admin' | 'head-mod' | 'mod';
type Focus = 'all' | 'moderation' | 'reports' | 'skillshots' | 'comments' | 'trusted';

export default async function StaffRoute({ kind, title, focus = 'all' }: { kind: PanelKind; title: string; focus?: Focus }) {
  const user = await requirePanel(kind);
  const permission: Record<Focus, Permission> = { all:'reports.view', moderation:'moderation.view', reports:'reports.view', skillshots:'skillshots.view', comments:'comments.view', trusted:'trusted_contributor.review' };
  if (!user.permissions.includes(permission[focus])) return <p>This area is unavailable for your account.</p>;
  return <StaffPanel title={title} focus={focus}/>;
}

import { requirePanel } from '../../lib/authz';
import { canViewCase } from '../../lib/report-case-policy';
import ReportCase from './report-case';
export default async function ReportCaseRoute({kind,id}:{kind:'admin'|'head-mod'|'mod';id:string}) {
  const actor=await requirePanel(kind);
  if(!canViewCase(actor,'PROFILE'))return <p>This area is unavailable for your account.</p>;
  return <ReportCase id={id}/>;
}

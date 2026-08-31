'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { moderationActions, readable } from '../../lib/staff-ui';
import { useStaff } from './staff-shell';
import StaffDialog from './staff-dialog';
import { StaffEmpty, StaffError, StaffSkeleton, StaffStatus } from './staff-states';

type Report = { reporter: string; category: string; details: string; created_at: string; status: string };
type Item = { id: string; source: string; target_type: string; target_id: string; category: string; severity: string; status: string; created_at: string; original_created_at?: string; username: string; display_name: string; has_avatar: boolean; bio?: string; title?: string; description?: string; comment_body?: string; post_id?: string; context_title?: string; current_status?: string; report_count: number; reports: Report[]; history: { action: string; username: string; created_at: string }[] };
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Not available';
function Preview({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false);
  if (item.target_type === 'SKILLSHOT') return <div className="moderationImage">{!failed && !['PURGING','PURGED'].includes(item.current_status || '') ? <Image unoptimized src={`/api/images/${encodeURIComponent(item.target_id)}?variant=thumbnail`} width={720} height={450} alt={item.title || 'Flagged Skillshot'} loading="lazy" onError={()=>setFailed(true)}/> : <span>Image unavailable</span>}</div>;
  if (item.target_type === 'COMMENT') return <div className="moderationQuote"><span className="eyebrow">COMMENT</span><blockquote>{item.comment_body || 'This comment is no longer available.'}</blockquote>{item.post_id && <Link href={`/shots/${encodeURIComponent(item.post_id)}`}>On: {item.context_title || 'View Skillshot'} ↗</Link>}</div>;
  return <div className="moderationProfile"><span className="teamAvatar">{item.has_avatar && !failed ? <Image unoptimized src={`/api/avatars/${encodeURIComponent(item.username)}`} width={64} height={64} alt="" onError={()=>setFailed(true)}/> : (item.display_name || '?').slice(0,1)}</span><b>{item.display_name || 'Profile unavailable'}</b><p>{item.bio || 'No bio provided.'}</p><small>Current saved profile. Rejected replacement images are not retained.</small></div>;
}
export default function ModerationQueue({ focus }: { focus: string }) {
  const user = useStaff();
  const [filters,setFilters] = useState({type: focus==='skillshots'?'SKILLSHOT':focus==='comments'?'COMMENT':'ALL',source:focus==='reports'?'REPORT':focus==='moderation'?'AUTO':'ALL',status:'PENDING',severity:'ALL',reason:'',page:'1'});
  const [result,setResult] = useState<{key:string;items:Item[];hasMore:boolean}|null>(null);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const [detail,setDetail] = useState<Item|null>(null);
  const [deleting,setDeleting] = useState<Item|null>(null);
  const [busy,setBusy] = useState('');
  const [message,setMessage] = useState('');
  const query = new URLSearchParams(filters).toString();
  const key = `${query}:${revision}`;
  useEffect(()=>{
    const controller = new AbortController();
    fetch(`/api/staff/moderation?${query}`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(data=>setResult({...data,key})).catch(()=>{if(!controller.signal.aborted)setError(key);});
    return ()=>controller.abort();
  },[query,key]);
  const change = (name:string,value:string) => setFilters(current=>({...current,[name]:value,page:name==='page'?value:'1'}));
  async function act(item:Item,action:string) {
    setBusy(item.id); setMessage('');
    try {
      const response = await fetch('/api/staff/moderation',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({queueId:item.id,action})});
      if(!response.ok) throw new Error();
      setMessage('Moderation action saved.'); setDetail(null);setDeleting(null);setRevision(v=>v+1);window.dispatchEvent(new Event('staff-updated'));
    } catch {setMessage('The action could not be saved. Check your access and try again.');}
    finally {setBusy('');}
  }
  const actions = (item:Item) => item.status==='PENDING' ? <div className="staffActions">{moderationActions(item.target_type,user.permissions).map(action=><button type="button" key={action} disabled={!!busy} className={action==='APPROVE'?'staffPrimary':action==='DELETE'?'staffDanger':''} onClick={()=>{if(action==='DELETE'){setDetail(null);setDeleting(item);}else void act(item,action);}}>{busy===item.id?'Saving…':readable(action)}</button>)}{item.target_type==='PROFILE' && <p>Profile flags require account review.{['OWNER','ADMIN'].includes(user.role)&&user.permissions.includes('users.view')&&<> <Link href="/admin/users">Open user management ↗</Link></>}</p>}</div>:null;
  return <section className="moderationWorkspace" aria-label="Moderation review">
    <div className="staffTabs" aria-label="Review source">{[['ALL','All sources'],['AUTO','Automatic Flags'],['REPORT','User Reports']].filter(([value])=>value!=='REPORT'||user.permissions.includes('reports.view')).map(([value,label])=><button type="button" key={value} aria-pressed={filters.source===value} onClick={()=>change('source',value)}>{label}</button>)}</div>
    <div className="staffFilters"><div className="staffTabs" aria-label="Content type">{[['ALL','All'],['IMAGE','Images'],['PROFILE','Profiles'],['SKILLSHOT','Skillshots'],['COMMENT','Comments']].map(([value,label])=><button type="button" key={value} aria-pressed={filters.type===value} onClick={()=>change('type',value)}>{label}</button>)}</div><div className="staffFilterFields">
      <label>Status<select value={filters.status} onChange={e=>change('status',e.target.value)}>{[['PENDING','Pending'],['RESOLVED','Resolved'],['DISMISSED','Dismissed'],['ALL','All statuses']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
      <label>Severity<select value={filters.severity} onChange={e=>change('severity',e.target.value)}><option value="ALL">All severities</option><option value="BORDERLINE">Borderline</option><option value="HIGH">High confidence</option></select></label>
      <label>Reason<input value={filters.reason} placeholder="All reasons · search" maxLength={100} onChange={e=>change('reason',e.target.value)}/></label>
    </div></div>
    <p className="staffHint">Automatic flags are signals for human review, not a final judgment. Images and Skillshots refer to the same visual uploads.</p>
    <p role="status">{message}</p>
    {error===key?<StaffError retry={()=>setRevision(v=>v+1)}/>:result?.key!==key?<StaffSkeleton/>:!result.items.length?<StaffEmpty title={filters.source==='REPORT'?'No open reports':'No moderation items'}>{filters.status==='PENDING'&&!filters.reason?"You're all caught up.":'No items match these filters.'}</StaffEmpty>:<>
      <div className="moderationGrid">{result.items.map(item=><article className="moderationCard" key={item.id}><Preview item={item}/><div className="moderationCardBody"><div className="staffCardTop"><span className="eyebrow">{readable(item.target_type)}</span><StaffStatus value={item.status}/></div><h2>{item.title || (item.username?`@${item.username}`:'Unknown creator')}</h2>{item.title&&<p className="staffCreator">@{item.username || 'unknown'}</p>}<dl className="staffFacts"><div><dt>Reason</dt><dd>{readable(item.category)}</dd></div><div><dt>Detection</dt><dd><StaffStatus value={item.severity}/></dd></div><div><dt>{item.source==='REPORT'?'Reported':'Flagged'}</dt><dd>{date(item.created_at)}</dd></div><div><dt>Source</dt><dd>{item.source==='REPORT'?`User reports (${item.report_count})`:'Automatic moderation'}</dd></div></dl>{item.source!=='REPORT'&&<p className="staffHint">Automatically flagged for review.</p>}{item.source==='REPORT'&&item.reports[0]&&<p className="staffHint">Reported by @{item.reports[0].reporter || 'unavailable'}</p>}<button type="button" className="staffDetailLink" onClick={()=>setDetail(item)}>View full details ↗</button>{actions(item)}</div></article>)}</div>
      <div className="staffPagination"><button disabled={filters.page==='1'} onClick={()=>change('page',String(Number(filters.page)-1))}>Previous</button><span>Page {filters.page}</span><button disabled={!result.hasMore} onClick={()=>change('page',String(Number(filters.page)+1))}>Next</button></div>
    </>}
    {detail&&<StaffDialog title="Moderation details" onClose={()=>{if(!busy)setDetail(null);}}><Preview item={detail}/><dl className="staffFacts"><div><dt>Creator</dt><dd>@{detail.username || 'unavailable'}</dd></div><div><dt>Content type</dt><dd>{readable(detail.target_type)}</dd></div><div><dt>Reason</dt><dd>{readable(detail.category)}</dd></div><div><dt>Detection</dt><dd><StaffStatus value={detail.severity}/></dd></div><div><dt>Created</dt><dd>{date(detail.original_created_at)}</dd></div><div><dt>Flagged</dt><dd>{date(detail.created_at)}</dd></div><div><dt>Review status</dt><dd><StaffStatus value={detail.status}/></dd></div><div><dt>Current content</dt><dd><StaffStatus value={detail.current_status || 'UNAVAILABLE'}/></dd></div></dl>{detail.description&&<p>{detail.description}</p>}<h3>User reports ({detail.report_count})</h3>{detail.reports.length?detail.reports.map((r,i)=><div className="staffHistoryItem" key={i}><b>@{r.reporter} · {readable(r.category)}</b><p>{r.details || 'No additional details.'}</p><small>{date(r.created_at)} · {readable(r.status)}</small></div>):<p>No community reports.</p>}<h3>Previous moderation actions</h3>{detail.history.length?detail.history.map((h,i)=><div className="staffHistoryItem" key={i}>{readable(h.action)} · @{h.username || 'system'}<small>{date(h.created_at)}</small></div>):<p>No previous actions recorded.</p>}<p className="staffHint">Showing up to 10 recent reports and moderation actions.</p>{actions(detail)}<p role="status">{message}</p></StaffDialog>}
    {deleting&&<StaffDialog title="Delete this content?" onClose={()=>{if(!busy)setDeleting(null);}}><p>This removes the content from public view. Skillshot files remain subject to the existing retention and appeal policy.</p><p>This action cannot be easily undone.</p><div className="staffActions"><button disabled={!!busy} onClick={()=>setDeleting(null)}>Cancel</button><button className="staffDanger" disabled={!!busy} onClick={()=>act(deleting,'DELETE')}>{busy?'Deleting…':'Delete'}</button></div><p role="status">{message}</p></StaffDialog>}
  </section>;
}

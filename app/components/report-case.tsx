'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useStaff } from './staff-shell';
import { panelForRole } from '../../lib/roles';
import { readable } from '../../lib/staff-ui';
import type { CaseAction } from '../../lib/report-case-policy';
import StaffDialog from './staff-dialog';
import { StaffStatus,StaffSkeleton } from './staff-states';

type Person={id:string;username:string;display_name:string;bio?:string;location?:string;skills?:string[];website?:string;social_links?:Record<string,string>;status:string;profile_status?:string;has_avatar?:boolean};
type Post={id:string;title:string;description?:string;category?:string;skills?:string[];username:string;created_at:string;status:string;author_status?:string};
type Comment={id:string;body:string;username:string;created_at:string;status:string;parent_id?:string;post_id:string};
type CaseData={case:{id:string;number:number;version:number;status:string;target_type:string;created_at:string;updated_at:string;assigned_username?:string;decision?:string;decision_reason?:string};content:{kind:string;profile?:Person;recent?:Post[];post?:Post;comment?:Comment;context?:Comment[];contextTruncated?:boolean}|null;actions:CaseAction[];reports:{id:string;category:string;details:string;reporter:string;created_at:string;status:string}[];reportsMore:boolean;summary:{category:string;count:number}[];events:{id:string;actor:string;action:string;reason:string;created_at:string}[];historyMore:boolean;flags:{category:string;severity:string;status:string;created_at:string}[];reviewers:{id:string;username:string;role:string;canEscalate:boolean}[]};
const labels:Record<CaseAction,string>={OPEN:'Start review',NOTE:'Add note',ASSIGN:'Assign',ESCALATE:'Escalate',KEEP:'Keep Content',HIDE:'Hide Content',DELETE:'Delete Content',DISMISS:'Dismiss Report',RESOLVE:'Mark Resolved'};
const date=(value:string)=>new Date(value).toLocaleString();
function CaseImage({src,avatar=false}:{src:string;avatar?:boolean}) {
  const [failed,setFailed]=useState(false);
  return failed?<p role="status">Image unavailable — it may have been removed or storage may be temporarily unavailable.</p>:<Image unoptimized className={avatar?'caseAvatar':'caseImage'} src={src} width={avatar?160:1200} height={avatar?160:800} alt={avatar?'Current saved profile image':'Actual reported Skillshot or conversation image'} onError={()=>setFailed(true)}/>;
}
export default function ReportCase({id}:{id:string}) {
  const staff=useStaff(),root=panelForRole(staff.role);
  const [data,setData]=useState<CaseData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [historyPage,setHistoryPage]=useState(1),[reportsPage,setReportsPage]=useState(1),[revision,setRevision]=useState(0);
  const [confirm,setConfirm]=useState<CaseAction|null>(null),[reason,setReason]=useState(''),[note,setNote]=useState(''),[assignee,setAssignee]=useState('');
  const opened=useRef('');
  const reload=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/staff/cases/${encodeURIComponent(id)}?historyPage=${historyPage}&reportsPage=${reportsPage}`,{signal:controller.signal}).then(async r=>{const result=await r.json();if(!r.ok)throw Error(result.error||'Unable to load this case.');return result as CaseData;}).then(result=>{setData(result);setError('');}).catch(e=>{if(!controller.signal.aborted)setError(e.message||'Unable to load this case.');});
    return()=>controller.abort();
  },[id,historyPage,reportsPage,revision]);
  useEffect(()=>{
    if(!data||data.case.status!=='PENDING'||!data.actions.includes('OPEN')||opened.current===data.case.id)return;
    opened.current=data.case.id;
    // Explicit authenticated mutation; neither GET nor link prefetch opens a case.
    fetch(`/api/staff/cases/${data.case.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'OPEN',version:data.case.version})}).then(async r=>{if(!r.ok&&r.status!==409){setMessage('Could not start review. Reload the case and try again.');}reload();}).catch(()=>setMessage('Could not start review. Check your connection.'));
  },[data,reload]);
  async function act(action:CaseAction) {
    if(!data||busy)return;setBusy(true);setMessage('');
    try {
      const response=await fetch(`/api/staff/cases/${data.case.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,version:data.case.version,reason:action==='NOTE'?note:reason,assignedTo:assignee})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'The action could not be saved.');
      setMessage('Case updated.');setConfirm(null);setReason('');if(action==='NOTE')setNote('');reload();window.dispatchEvent(new Event('staff-updated'));
    }catch(e){setMessage(e instanceof Error?e.message:'Please try again.');reload();}finally{setBusy(false);}
  }
  if(error)return <section className="staffPageBody"><Link href={root+'/reports'}>← Back to Reports</Link><p role="alert">{error}</p><button onClick={reload}>Retry</button></section>;
  if(!data)return <StaffSkeleton/>;
  const item=data.case,content=data.content,closed=['RESOLVED','DISMISSED'].includes(item.status);
  const media=`/api/staff/cases/${item.id}/image`;
  const target=content?.profile||content?.comment||content?.post;
  const post=content?.post;
  const publicAvailable=content?.profile?content.profile.status==='ACTIVE'&&content.profile.profile_status==='VISIBLE':post?.status==='VISIBLE'&&post.author_status==='ACTIVE'&&(!content?.comment||content.comment.status==='VISIBLE');
  const publicUrl=content?.profile?'/users/'+encodeURIComponent(content.profile.username):post?'/shots/'+post.id+(content?.comment?'#comment-'+content.comment.id:''):null;
  const priority=data.flags.some(flag=>flag.severity==='HIGH')||data.summary.some(row=>['NSFW','HATE','VIOLENCE'].includes(row.category))?'High':'Normal';
  function ask(action:CaseAction){setReason('');setAssignee('');setConfirm(action);setMessage('');}
  return <div className="staffPageBody caseWorkspace">
    <header className="staffCardTop"><div><Link href={root+'/reports'}>← Back to Reports</Link><h1>Report #R-{item.number}</h1><StaffStatus value={item.status}/> <span>Priority: {priority}</span></div>{!closed&&data.actions.includes('RESOLVE')&&<button onClick={()=>ask('RESOLVE')}>Mark Resolved</button>}</header>
    <p role="status">{message}</p>
    <section className="staffSection caseInformation"><h2>Report details</h2><dl className="staffFacts"><div><dt>Report ID</dt><dd>R-{item.number}</dd></div><div><dt>Reported user</dt><dd>{target?'@'+target.username:'Unavailable'}</dd></div><div><dt>Reports</dt><dd>{data.summary.reduce((n,r)=>n+Number(r.count),0)}</dd></div><div><dt>Created</dt><dd>{date(item.created_at)}</dd></div><div><dt>Assigned to</dt><dd>{item.assigned_username?'@'+item.assigned_username:'Unassigned'}</dd></div><div><dt>Last updated</dt><dd>{date(item.updated_at)}</dd></div><div><dt>Human decision</dt><dd>{item.decision?readable(item.decision):'Pending'}</dd></div><div><dt>Source</dt><dd>{data.summary.length?'User reports':''}{data.summary.length&&data.flags.length?' · ':''}{data.flags.length?'Automatic flags':''}</dd></div></dl>
      <p>{data.summary.map(row=>`${row.count} × ${readable(row.category)}`).join(' · ')}</p>{item.decision_reason&&<p>Decision reason: {item.decision_reason}</p>}
      {data.flags.length>0&&<div className="caseFlag"><h3>Automatic flag</h3><p>This is a signal for human review, not a final decision.</p>{data.flags.map((flag,i)=><p key={i}>{readable(flag.category)} · {readable(flag.severity)} · {date(flag.created_at)}</p>)}</div>}
      {!closed&&data.actions.includes('ASSIGN')&&<button onClick={()=>ask('ASSIGN')}>Assign reviewer</button>}
    </section>
    <section className="staffSection caseContent"><h2>Reported {content?.kind.toLowerCase()||item.target_type.toLowerCase()}</h2>
      {!content?<p>Content unavailable. The source record has been removed. The case history is retained below.</p>:<>
        {content.profile?<><CaseImage key={media} src={media} avatar/><h3>{content.profile.display_name}</h3><p>@{content.profile.username}</p><p>{content.profile.bio||'No bio provided.'}</p><p>{content.profile.location}</p><p>{content.profile.skills?.join(', ')}</p><p>Current saved profile image. Previously rejected replacements are not shown.</p>{content.profile.website&&<p><a href={content.profile.website} target="_blank" rel="noopener noreferrer">Website ↗</a></p>}{Object.entries(content.profile.social_links||{}).map(([name,url])=><p key={name}><a href={url} target="_blank" rel="noopener noreferrer">{name} ↗</a></p>)}<h3>Recent Skillshots</h3><div className="caseRecent">{content.recent?.map(shot=><Link key={shot.id} target="_blank" rel="noopener noreferrer" href={'/shots/'+shot.id}><Image unoptimized src={'/api/images/'+shot.id+'?variant=thumbnail'} width={240} height={180} alt={shot.title}/><span>{shot.title}</span></Link>)}</div>{!content.recent?.length&&<p>No visible Skillshots.</p>}</>:<>
          {post&&!['PURGED','PURGING'].includes(post.status)?<><CaseImage key={media} src={media}/><a className="staffDetailLink" href={media+'?variant=original'} target="_blank" rel="noopener noreferrer">Open original image ↗</a><h3>{post.title}</h3><p>@{post.username} {post.created_at&&'· '+date(post.created_at)}</p>{post.category&&<p>{post.category} · {post.skills?.join(', ')}</p>}<p>{post.description}</p></>:<p>Parent image unavailable — removed or past its retention period.</p>}
          {content.comment&&<div className="caseConversation"><h3>Comment thread</h3>{content.context?.filter(c=>c.id===content.comment?.parent_id).map(c=><div key={c.id}><b>Parent comment · @{c.username}</b><p>{c.body}</p><small>{date(c.created_at)}</small></div>)}<div className="caseReported"><strong>REPORTED {content.kind}</strong><p>@{content.comment.username} · {date(content.comment.created_at)}</p><blockquote>{content.comment.body}</blockquote><StaffStatus value={content.comment.status}/></div>{content.context?.filter(c=>c.id!==content.comment?.parent_id).map(c=><div key={c.id}><b>Reply · @{c.username}</b><p>{c.body}</p><small>{date(c.created_at)}</small></div>)}{content.contextTruncated&&<p>Showing the first 20 context messages. Open the Skillshot for more visible conversation.</p>}</div>}
        </>}
        {publicAvailable&&publicUrl?<p><Link href={publicUrl} target="_blank" rel="noopener noreferrer">Open {content.profile?'Profile':content.comment?'Comment':'Skillshot'} ↗</Link></p>:<p>Unavailable on the public site: {readable(String(content.profile?.profile_status||content.comment?.status||post?.status||'REMOVED'))}. Retained content is shown here for authorized review.</p>}
        {content.profile&&staff.permissions.includes('users.view')&&['ADMIN','OWNER'].includes(staff.role)&&<Link href="/admin/users" target="_blank">Take account action ↗</Link>}
      </>}
    </section>
    <section className="staffSection"><h2>Associated reports</h2>{data.reports.map(report=><article className="staffHistoryItem" key={report.id}><b>@{report.reporter||'unavailable'} · {readable(report.category)}</b><p>{report.details||'No additional details.'}</p><small>{date(report.created_at)} · {readable(report.status)}</small></article>)}{!data.reports.length&&<p>No user reports on this page. This may be an automatic flag.</p>}<div className="staffPagination"><button disabled={reportsPage===1} onClick={()=>setReportsPage(p=>p-1)}>Previous reports</button><span>Page {reportsPage}</span><button disabled={!data.reportsMore} onClick={()=>setReportsPage(p=>p+1)}>More reports</button></div></section>
    <section className="staffSection"><h2>Case history</h2><ol className="caseTimeline">{data.events.map(event=><li key={event.id}><b>{readable(event.action)}</b><small>{date(event.created_at)} · {event.actor?'@'+event.actor:'System'}</small>{event.reason&&<p>{event.reason}</p>}</li>)}</ol>{!data.events.length&&<p>No recorded events.</p>}<div className="staffPagination"><button disabled={historyPage===1} onClick={()=>setHistoryPage(p=>p-1)}>Newer events</button><span>Page {historyPage}</span><button disabled={!data.historyMore} onClick={()=>setHistoryPage(p=>p+1)}>Older events</button></div></section>
    <section className="staffSection"><h2>Internal moderation notes</h2><p>Visible only to authorized staff. Notes are retained in case history with their author and timestamp.</p>{data.actions.includes('NOTE')&&<form onSubmit={e=>{e.preventDefault();void act('NOTE');}}><label>Note<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} required disabled={busy}/></label><button disabled={busy||!note.trim()}>Add note</button></form>}</section>
    <section className="staffSection caseDecision"><h2>Moderation decision</h2>{closed?<p>This case is {readable(item.status).toLowerCase()}. A new report on this content will reopen the same case.</p>:<><p>Keep approves the content. Dismiss closes an invalid or unnecessary report without changing the content.</p><div className="staffActions">{data.actions.filter(action=>['KEEP','HIDE','DELETE','DISMISS','ESCALATE'].includes(action)).map(action=><button key={action} disabled={busy||(!content&&['KEEP','HIDE','DELETE'].includes(action))} className={action==='DELETE'?'staffDanger':action==='KEEP'?'staffPrimary':''} onClick={()=>ask(action)}>{labels[action]}</button>)}</div></>}</section>
    {confirm&&<StaffDialog title={confirm==='DELETE'?'Delete this content permanently?':confirm==='KEEP'?'Keep this content?':labels[confirm]} onClose={()=>{if(!busy)setConfirm(null);}}><p>{confirm==='KEEP'?'The report will be resolved and the content will remain visible.':confirm==='DELETE'?'The content will be removed from public view. Image files are retained for 30 days under the existing appeal and legal-retention policy before eligible cleanup.':confirm==='DISMISS'?'Dismiss this report without changing content visibility.':confirm==='RESOLVE'?'Close the case and record your decision without changing content visibility.':'This action is recorded in the case history.'}</p>{['ASSIGN','ESCALATE'].includes(confirm)&&<label>Reviewer<select required value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Select reviewer</option>{data.reviewers.filter(r=>confirm!=='ESCALATE'||r.canEscalate).map(r=><option key={r.id} value={r.id}>@{r.username} · {readable(r.role)}</option>)}</select></label>}<label>Decision reason / internal note<textarea value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)} placeholder={confirm==='KEEP'?'No violation / allowed content / false positive':'Explain the decision'}/></label><div className="staffActions"><button disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button><button className={confirm==='DELETE'?'staffDanger':'staffPrimary'} disabled={busy||(['ASSIGN','ESCALATE'].includes(confirm)&&!assignee)||(['HIDE','DELETE','ESCALATE'].includes(confirm)&&!reason.trim())} onClick={()=>act(confirm)}>{busy?'Saving…':confirm==='DELETE'?'Delete permanently':'Confirm'}</button></div><p role="status">{message}</p></StaffDialog>}
  </div>;
}

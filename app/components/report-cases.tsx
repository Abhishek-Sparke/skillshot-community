'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect,useState } from 'react';
import { useStaff } from './staff-shell';
import { StaffEmpty,StaffError,StaffSkeleton,StaffStatus } from './staff-states';
import { panelForRole } from '../../lib/roles';
import { CASE_STATUSES } from '../../lib/report-case-policy';
import { readable } from '../../lib/staff-ui';

type Item={id:string;number:number;target_type:string;status:string;title?:string;display_name?:string;username?:string;comment_body?:string;parent_id?:string;created_at:string;report_count:number;reporter?:string;assigned_username?:string;automatic:boolean;priority:string;reasons:{category:string;count:number}[]};
export default function ReportCases() {
  const staff=useStaff(),root=panelForRole(staff.role);
  const search=useSearchParams();
  const [filters,setFilters]=useState({status:search.get('mine')==='1'?'ALL':'PENDING',source:'ALL',type:'ALL',mine:search.get('mine')==='1'?'1':'0',high:'0',page:'1'});
  const [data,setData]=useState<{key:string;items:Item[];hasMore:boolean;myCases:{status:string;count:number}[]}|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const query=new URLSearchParams(filters).toString(),key=query+revision;
  useEffect(()=>{const controller=new AbortController();fetch('/api/staff/cases?'+query,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(result=>setData({...result,key})).catch(()=>{if(!controller.signal.aborted)setError(key);});return()=>controller.abort();},[key,query]);
  function change(name:string,value:string){setFilters(current=>({...current,[name]:value,page:name==='page'?value:'1'}));}
  return <section className="moderationWorkspace" aria-label="Report cases">
    <div className="staffCardTop"><h2>Reports</h2><button type="button" onClick={()=>setFilters(current=>({...current,mine:'1',status:'ALL',page:'1'}))}>My Cases {data?data.myCases.reduce((n,row)=>n+Number(row.count),0):'…'}</button></div>
    {data&&<p className="staffHint">Assigned to you: {data.myCases.map(row=>`${readable(row.status)} ${row.count}`).join(' · ')||'No open cases'}</p>}
    <div className="staffFilters"><div className="staffTabs" aria-label="Case status">{['ALL',...CASE_STATUSES].map(status=><button type="button" key={status} aria-pressed={filters.status===status} onClick={()=>change('status',status)}>{status==='PENDING'?'Pending':readable(status)}</button>)}</div>
      <div className="staffFilterFields"><label>Content<select value={filters.type} onChange={e=>change('type',e.target.value)}>{['ALL','SKILLSHOT','PROFILE','COMMENT','REPLY'].map(value=><option key={value}>{value}</option>)}</select></label><label>Source<select value={filters.source} onChange={e=>change('source',e.target.value)}><option value="ALL">All sources</option><option value="REPORT">User reports</option><option value="AUTO">Automatic flags</option></select></label><label>Assignment<select value={filters.mine} onChange={e=>change('mine',e.target.value)}><option value="0">Everyone</option><option value="1">Assigned to me</option></select></label><label>Priority<select value={filters.high} onChange={e=>change('high',e.target.value)}><option value="0">All priorities</option><option value="1">High priority</option></select></label></div>
    </div>
    {error===key?<StaffError retry={()=>setRevision(v=>v+1)}/>:data?.key!==key?<StaffSkeleton/>:!data.items.length?<StaffEmpty title={filters.mine==='1'?'No cases assigned to you.':filters.status==='PENDING'?'All clear — no reports need review.':'No cases match these filters.'}/>:<>
      <div className="moderationGrid">{data.items.map(item=><article className="moderationCard reportCompactCard" key={item.id}><div className="moderationCardBody"><div className="staffCardTop"><strong>Report #{item.number}</strong><StaffStatus value={item.status}/></div><p className="reportCategoryLabel">{item.reasons[0]?.category ? readable(item.reasons[0].category) : readable(item.target_type)}</p><p className="reportMetaText">{item.reporter ? `Reported by @${item.reporter}` : 'Automatic flag'}<br/>{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p><Link className="staffDetailLink compactReviewBtn" prefetch={false} href={`${root}/reports/${item.id}`}>Review →</Link></div></article>)}</div>
      <div className="staffPagination"><button disabled={filters.page==='1'} onClick={()=>change('page',String(Number(filters.page)-1))}>Previous</button><span>Page {filters.page}</span><button disabled={!data.hasMore} onClick={()=>change('page',String(Number(filters.page)+1))}>Next</button></div>
    </>}
  </section>;
}

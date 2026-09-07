'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter,useSearchParams } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import { SEARCH_ROLES,searchFilters } from '../../lib/search-query';
import type { UserRole } from '../../lib/roles';
import CreatorUsername from './creator-username';
import { readable } from '../../lib/staff-ui';
import type { CreatorRankId } from '../../lib/creator-rank';

type Person={username:string;display_name:string;skills:string[];role:UserRole;creatorRank:CreatorRankId;avatarUrl:string};
type Shot={id:string;title:string;display_name:string;username:string;skills:string[];role:UserRole;creatorRank:CreatorRankId;imageUrl:string;image_width:number;image_height:number;likes:number;comments:number};
type Results={people:Person[];shots:Shot[];categories:string[];skills:string[];peopleMore:boolean;shotsMore:boolean};
type Filters={q:string;role:string[];category:string;skill:string;tag:string;type:string;sort:string;page:number};
function initial(params:URLSearchParams):Filters {const f=searchFilters(params);return {q:f.q,role:f.role,category:f.category,skill:f.skill,tag:f.tag,type:f.type,sort:f.sort,page:f.page};}
export default function AdvancedSearch() {
  const params=useSearchParams(),router=useRouter();
  const [filter,setFilter]=useState<Filters>(()=>initial(new URLSearchParams(params.toString()))),[results,setResults]=useState<Results|null>(null);
  const [panel,setPanel]=useState(false),[active,setActive]=useState(-1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[mobileFilters,setMobileFilters]=useState(false);
  const region=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),filterButton=useRef<HTMLButtonElement>(null),filterPanel=useRef<HTMLDivElement>(null);
  const query=new URLSearchParams({q:filter.q,role:filter.role.join(','),category:filter.category,skill:filter.skill,tag:filter.tag,type:filter.type,sort:filter.sort,page:String(filter.page)}).toString();
  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      fetch('/api/search?'+query+(panel?'&suggest=1':''),{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{setResults(data);setError('');setLoading(false);}).catch(()=>{if(!controller.signal.aborted){setError('Search is temporarily unavailable.');setLoading(false);}});
      const url=new URL(window.location.href);url.search=query;window.history.replaceState(null,'',url);
    },250);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[query,panel,revision]);
  useEffect(()=>{const pop=()=>{setFilter(initial(new URLSearchParams(window.location.search)));setLoading(true);setPanel(false);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(region.current&&!region.current.contains(event.target as Node)){setPanel(false);setActive(-1);}};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
useEffect(()=>{if(!mobileFilters)return;const node=filterPanel.current;if(!node)return;const previous=document.activeElement as HTMLElement|null,opener=filterButton.current;const focusable=()=>Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled])'));focusable()[0]?.focus();const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMobileFilters(false);filterButton.current?.focus();return;}if(event.key!=='Tab')return;const items=focusable(),first=items[0],last=items.at(-1);if(!first||!last)return;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};document.addEventListener('keydown',keyboard);const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',keyboard);document.body.style.overflow=overflow;if(previous&&!opener?.contains(document.activeElement))previous.focus();};},[mobileFilters]);
  function change<K extends keyof Filters>(key:K,value:Filters[K]){setFilter(current=>({...current,[key]:value,page:key==='page'?Number(value):1}));setLoading(true);setActive(-1);}
  function clear(){setFilter({q:'',role:[],category:'',skill:'',tag:'',type:'all',sort:'newest',page:1});setLoading(true);}
  function chooseKind(kind:'skill'|'category',value:string){setFilter(current=>({...current,q:'',[kind]:value,page:1}));setLoading(true);setPanel(false);setActive(-1);}
  type SuggestionItem = {
    group: string;
    label: string;
    sublabel?: string;
    avatarUrl?: string;
    imageUrl?: string;
    action: () => void;
  };
  const suggestions: SuggestionItem[] = [
    ...(results?.people.slice(0,5)||[]).map(p=>({group:'People',label:p.display_name,sublabel:'@'+p.username,avatarUrl:p.avatarUrl,action:()=>router.push('/users/'+encodeURIComponent(p.username))})),
    ...(results?.shots.slice(0,5)||[]).map(p=>({group:'Skillshots',label:p.title,sublabel:'by '+p.display_name,imageUrl:p.imageUrl,action:()=>router.push('/shots/'+p.id)})),
    ...(results?.skills.slice(0,5)||[]).map(skill=>({group:filter.q?'Tags':'Popular tags',label:'#'+skill,action:()=>chooseKind('skill',skill)})),
    ...(results?.categories.filter(c=>!filter.q||c.toLowerCase().startsWith(filter.q.toLowerCase())).slice(0,5)||[]).map(category=>({group:'Categories',label:category,action:()=>chooseKind('category',category)}))
  ];
  const people=filter.type!=='shots',shots=filter.type!=='people';
  return <section className="searchWorkspace">
    <div className="liveSearch" ref={region}>
      <label htmlFor="skillshot-search">Search Skillshots, people, skills or tags...</label>
      <input id="skillshot-search" ref={input} type="search" value={filter.q} autoComplete="off" maxLength={100} role="combobox" aria-autocomplete="list" aria-expanded={panel} aria-controls="search-suggestions" aria-activedescendant={panel&&active>=0?'suggestion-'+active:undefined} placeholder="Search Skillshots, people, skills or tags..." onFocus={()=>{setPanel(true);setActive(-1);}} onChange={e=>{change('q',e.target.value);setFilter(current=>({...current,sort:e.target.value?'relevance':'newest'}));setPanel(true);}} onKeyDown={e=>{if(e.key==='Escape'){setPanel(false);setActive(-1);}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setPanel(true);setActive(i=>suggestions.length?(i<0?(e.key==='ArrowDown'?0:suggestions.length-1):(i+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length):-1);}if(e.key==='Enter'){e.preventDefault();if(panel&&active>=0&&!loading)suggestions[active]?.action();setPanel(false);setActive(-1);}}}/>
      {panel&&<div className="searchSuggestions" id="search-suggestions" role="listbox" aria-label="Search suggestions">
        {loading?<p role="status" className="searchSuggestStatus">Searching…</p>:error?<p className="searchSuggestStatus">{error}</p>:suggestions.length?suggestions.map((s,i)=><div key={s.group+':'+s.label+':'+i}>
          {i===0||suggestions[i-1].group!==s.group?<h3>{s.group}</h3>:null}
          <button id={'suggestion-'+i} role="option" aria-selected={active===i} type="button" tabIndex={-1} className="searchSuggestItem" onPointerDown={e=>e.preventDefault()} onClick={()=>{s.action();setPanel(false);}}>
            {s.avatarUrl ? <span className="suggestAvatar"><img src={s.avatarUrl} alt="" width={22} height={22}/></span> : s.imageUrl ? <span className="suggestThumb"><img src={s.imageUrl} alt="" width={22} height={22}/></span> : null}
            <span className="suggestText"><b>{s.label}</b>{s.sublabel ? <small>{s.sublabel}</small> : null}</span>
          </button>
        </div>):<p className="searchSuggestStatus">No results found. Try people, skillshots, or tags.</p>}
        <button type="button" className="searchSuggestViewAll" onClick={()=>{setPanel(false);setActive(-1);}}>View all results →</button>
      </div>}
    </div>
    <button ref={filterButton} className="searchFilterToggle" type="button" aria-expanded={mobileFilters} onClick={()=>setMobileFilters(v=>!v)}>Filters</button>
    {mobileFilters&&<button className="searchFilterScrim" aria-label="Close filters" onClick={()=>{setMobileFilters(false);filterButton.current?.focus();}}/>}
    <div ref={filterPanel} className={'searchFilterPanel '+(mobileFilters?'isOpen':'')} role={mobileFilters?'dialog':undefined} aria-modal={mobileFilters||undefined} aria-label={mobileFilters?'Search filters':undefined}>
      <fieldset><legend>Role</legend><div className="searchRoles">{SEARCH_ROLES.map(role=><label key={role}><input type="checkbox" checked={filter.role.includes(role)} onChange={()=>change('role',filter.role.includes(role)?filter.role.filter(r=>r!==role):[...filter.role,role])}/>{readable(role)}</label>)}</div></fieldset>
      <label>Category<select value={filter.category} onChange={e=>change('category',e.target.value)}><option value="">All categories</option>{[...new Set([filter.category,...(results?.categories||[])])].filter(Boolean).map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Skill<select value={filter.skill} onChange={e=>change('skill',e.target.value)}><option value="">All skills</option>{[...new Set([filter.skill,...(results?.skills||[])])].filter(Boolean).map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Type<select value={filter.type} onChange={e=>change('type',e.target.value)}><option value="all">All</option><option value="shots">Skillshots</option><option value="people">People</option></select></label>
      <label>Sort<select value={filter.sort} onChange={e=>change('sort',e.target.value)}><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="liked">Most liked Skillshots</option><option value="commented">Most commented Skillshots</option></select></label><button type="button" onClick={clear}>Clear all</button><button className="searchApply" type="button" onClick={()=>{setMobileFilters(false);filterButton.current?.focus();}}>Apply filters</button>
    </div>
    <div className="searchChips">{filter.role.map(role=><button key={role} onClick={()=>change('role',filter.role.filter(r=>r!==role))}>{readable(role)} ×</button>)}{(['category','skill','tag'] as const).filter(key=>filter[key]).map(key=><button key={key} onClick={()=>change(key,'')}>{filter[key]} ×</button>)}</div>
    <header className="searchResultsHeading"><h2>{filter.q?`Search results for “${filter.q}”`:'Discover Skillshot'}</h2><div className="filters">{[['all','All'],['shots','Skillshots'],['people','People']].map(([type,label])=><button key={type} className={filter.type===type?'active':''} onClick={()=>change('type',type)}>{label}</button>)}</div></header>
    {error?<div className="emptyFeed" role="alert"><h3>{error}</h3><button onClick={()=>{setLoading(true);setRevision(v=>v+1);}}>Try again</button></div>:!loading&&results&&!((people&&results.people.length>0)||(shots&&results.shots.length>0))?<div className="emptyFeed"><span>✦</span><h3>No search results</h3><p>Nothing matched your search.</p></div>:<div aria-busy={loading}>{loading&&<p role="status">Searching…</p>}{people&&<section><h2>People</h2><div className="creatorResults">{results?.people.map(person=><article key={person.username}><Link href={'/users/'+encodeURIComponent(person.username)}>{person.avatarUrl&&<Image unoptimized src={person.avatarUrl} width={48} height={48} alt=""/>}</Link><CreatorUsername name={person.display_name} username={person.username} creatorRank={person.creatorRank} staffRole={person.role}/><p>{person.skills?.slice(0,3).join(' · ')}</p><Link href={'/users/'+encodeURIComponent(person.username)}>View profile →</Link></article>)}</div>{!loading&&!results?.people.length&&<p>No people found. Try another name or skill.</p>}</section>}
      {shots&&<section><h2>Skillshots</h2><div className="searchResults masonryGrid">{results?.shots.map(shot=><article key={shot.id}><Link className="searchImage" href={'/shots/'+shot.id}><Image unoptimized src={shot.imageUrl} width={shot.image_width||640} height={shot.image_height||480} alt={shot.title+' by '+shot.display_name} loading="lazy"/></Link><div><h3><Link href={'/shots/'+shot.id}>{shot.title}</Link></h3><p><CreatorUsername name={shot.display_name} username={shot.username} creatorRank={shot.creatorRank} staffRole={shot.role}/></p><p>{shot.skills?.slice(0,3).join(' · ')}</p><small>♡ {shot.likes} · ◌ {shot.comments}</small></div></article>)}</div>{!loading&&!results?.shots.length&&<p>No Skillshots found. Try people, skills or categories.</p>}</section>}
      <div className="searchPagination"><button disabled={filter.page===1||loading} onClick={()=>{setPanel(false);change('page',filter.page-1);}}>Previous</button><span>Page {filter.page}</span><button disabled={loading||!(results?.peopleMore||results?.shotsMore)} onClick={()=>{setPanel(false);change('page',filter.page+1);}}>Next</button></div></div>}
  </section>;
}

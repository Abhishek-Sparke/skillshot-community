'use client';
import Link from 'next/link';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import { createPortal } from 'react-dom';
const sections=[
  ['SETTINGS',[['Settings','/settings'],['Notifications','/settings/notifications'],['Appearance','/settings/appearance'],['Privacy','/settings/privacy'],['Account & Security','/settings/security']]],
  ['COMMUNITY',[['Trusted Contributor','/settings/trusted-contributor']]],
  ['SUPPORT',[['Help Center','/help'],['Report a Problem','/support/report'],['Community Guidelines','/community-guidelines'],['Contact Support','/support/contact']]],
  ['ABOUT',[['About Skillshot','/about'],['Terms of Service','/terms'],['Privacy Policy','/privacy']]],
] as const;
export default function SettingsMenu({name,dashboard,logout}:{name:string;dashboard?:string;logout:ReactNode}){
  const [view,setView]=useState<'account'|'settings'|null>(null);
  const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(!view)return;
    const node=dialog.current!,opener=trigger.current;node.showModal();
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{node.close();document.body.style.overflow=previous;if(opener?.closest('[inert]'))document.querySelector<HTMLButtonElement>('.publicNavToggle')?.focus();else opener?.focus();};
  },[view]);
  return <>
    <button ref={trigger} className="accountMenuTrigger" aria-label={`Account menu for ${name}`} aria-haspopup="dialog" aria-expanded={!!view} onClick={()=>setView('account')}><span aria-hidden="true">{name.trim().slice(0,1).toUpperCase()||'S'}</span><span className="accountMenuLabel">Account</span><span aria-hidden="true">⌄</span></button>
    {view&&createPortal(<dialog ref={dialog} className="settingsDialog" aria-labelledby="settings-menu-title" onCancel={()=>setView(null)} onClick={event=>{if(event.target===event.currentTarget)setView(null);}}>
      <div className="settingsDialogInner"><header><h2 id="settings-menu-title">{view==='settings'?'Settings & Support':name}</h2><button autoFocus aria-label={view==='settings'?'Close settings':'Close account menu'} onClick={()=>setView(null)}>×</button></header>
      {view==='account'?<div className="settingsMenuRows"><Link href="/profile" onClick={()=>setView(null)}>Profile <span>→</span></Link><button onClick={()=>setView('settings')}>Settings & Support <span>→</span></button>{dashboard&&<Link href={dashboard} onClick={()=>setView(null)}>Dashboard <span>↗</span></Link>}{logout}</div>:sections.map(([title,items])=><section key={title}><h3>{title}</h3><div className="settingsMenuRows">{items.map(([label,href])=><Link key={href} href={href} onClick={()=>setView(null)}>{label}<span aria-hidden="true">›</span></Link>)}</div></section>)}
      </div>
    </dialog>,document.body)}
  </>;
}

'use client';
import { useEffect } from 'react';
import { THEMES, type Theme } from '../../lib/settings-policy';
export function applyTheme(theme:Theme){
  const dark=theme==='dark'||theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.dataset.preference=theme;
  try{localStorage.setItem('skillshot-theme',theme);}catch{}
  document.cookie=`skillshot-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
export default function ThemeController(){
  useEffect(()=>{
    const controller=new AbortController();
    const system=matchMedia('(prefers-color-scheme: dark)');
    const update=()=>{if(document.documentElement.dataset.preference==='system')applyTheme('system');};
    system.addEventListener('change',update);
    const storage=(event:StorageEvent)=>{if(event.key==='skillshot-theme'&&THEMES.includes(event.newValue as Theme))applyTheme(event.newValue as Theme);};
    window.addEventListener('storage',storage);
    // A saved account preference takes precedence over this device's guest preference.
    fetch('/api/settings',{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok)return;const data=await response.json();const theme=data.preferences?.theme;
      if(THEMES.includes(theme))applyTheme(theme);
    }).catch(()=>{});
    return()=>{controller.abort();system.removeEventListener('change',update);window.removeEventListener('storage',storage);};
  },[]);
  return null;
}

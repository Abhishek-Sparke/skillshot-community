'use client';
import { useState } from 'react';
import { NOTIFICATION_GROUPS,THEMES,type Theme } from '../../lib/settings-policy';
import { applyTheme } from './theme-controller';
type Preferences={theme?:Theme;notifications?:Record<string,boolean>};
export default function PreferenceEditor({initial,section}:{initial:Preferences;section:'appearance'|'notifications'}){
  const [preferences,setPreferences]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function save(patch:Preferences){
    setBusy(true);setMessage('Saving…');
    try{const response=await fetch('/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save.');setPreferences(data.preferences);if(patch.theme)applyTheme(patch.theme);setMessage('Saved');}catch(error){setMessage(error instanceof Error?error.message:'Network error. Please try again.');}finally{setBusy(false);}
  }
  return <div className="settingsSection">{section==='appearance'?<fieldset disabled={busy}><legend>Choose how Skillshot looks.</legend><div className="themeOptions">{THEMES.map(theme=><label key={theme} className="themeOption"><input type="radio" name="theme" value={theme} checked={(preferences.theme||'system')===theme} onChange={()=>save({theme})}/><span className={`themeSwatch ${theme}`} aria-hidden="true"/><strong>{theme[0].toUpperCase()+theme.slice(1)}</strong></label>)}</div><p>System follows your device’s appearance. Your choice is saved to your account.</p></fieldset>:<>
    {Object.entries(NOTIFICATION_GROUPS).map(([group,items])=><fieldset disabled={busy} key={group}><legend>{group}</legend>{Object.entries(items).map(([key,label])=><label className="preferenceToggle" key={key}><span>{label}</span><input type="checkbox" checked={preferences.notifications?.[key]!==false} onChange={event=>save({notifications:{[key]:event.target.checked}})}/></label>)}</fieldset>)}<label className="preferenceToggle"><span>Important account & security emails <small>Always enabled to protect your account.</small></span><input type="checkbox" checked disabled/></label><p className="settingsHint">Preferences apply to new notifications. Email delivery requires the site’s email service to be configured.</p>
    </>}<p role="status" aria-live="polite">{message}</p></div>;
}

'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { normalizeSocialUrl, SOCIAL_PLATFORMS, type SocialPlatformKey } from '../../lib/social-links';

type EditorProfile = {
  displayName: string; username: string; bio: string; website: string; location: string;
  skills: string[]; socialLinks: Record<string, string>; avatarUrl: string;
};
type EditorPost = { id: string; title: string; featured: boolean };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}

function SocialIcon({ platform }: { platform: SocialPlatformKey }) {
  if (platform === 'github') return <svg className="socialIconSolid" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 6.83c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>;
  if (platform === 'instagram') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" className="socialIconFill"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="7.5" cy="8" r="1.2" className="socialIconFill"/><path d="M6.5 11v6M11 17v-6m0 2.6c.7-1.7 5-2.2 5 1.2V17"/></svg>;
}

const MAX_SOURCE_AVATAR_SIZE = 12 * 1024 * 1024;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const TARGET_AVATAR_SIZE = 500 * 1024;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
}

async function optimizeAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('Invalid image');
    if (bitmap.width === bitmap.height && bitmap.width <= 1024 && file.size <= TARGET_AVATAR_SIZE) return file;

    const sourceSize = Math.min(bitmap.width, bitmap.height);
    const outputSize = Math.min(1024, sourceSize);
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image optimization unavailable');
    context.drawImage(
      bitmap,
      Math.floor((bitmap.width - sourceSize) / 2),
      Math.floor((bitmap.height - sourceSize) / 2),
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    let quality = 0.9;
    let blob = await canvasBlob(canvas, quality);
    while (blob && blob.size > TARGET_AVATAR_SIZE && quality > 0.66) {
      quality -= 0.08;
      blob = await canvasBlob(canvas, quality);
    }
    if (!blob) throw new Error('Image optimization failed');
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-') || 'avatar';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export default function ProfileEditor({ profile, posts }: { profile: EditorProfile; posts: EditorPost[] }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [selectedFeatured, setSelectedFeatured] = useState(posts.filter(post => post.featured).map(post => post.id).slice(0, 3));
  const [socialValues, setSocialValues] = useState<Record<SocialPlatformKey, string>>(() => Object.fromEntries(SOCIAL_PLATFORMS.map(platform => [platform.key, profile.socialLinks[platform.key] || ''])) as Record<SocialPlatformKey, string>);
  const [socialErrors, setSocialErrors] = useState<Partial<Record<SocialPlatformKey, string>>>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const avatarSelection = useRef(0);

  useEffect(() => () => { if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  async function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const selection = ++avatarSelection.current;
    if (!AVATAR_TYPES.has(file.type)) {
      event.target.value = '';
      setAvatarFile(null);
      setAvatarPreview(profile.avatarUrl);
      setFeedback('Unsupported image format. Use PNG, JPG, or WebP.');
      return;
    }
    if (file.size > MAX_SOURCE_AVATAR_SIZE) {
      event.target.value = '';
      setAvatarFile(null);
      setAvatarPreview(profile.avatarUrl);
      setFeedback('That photo is too large to process. Please choose one smaller than 12 MB.');
      return;
    }

    setAvatarBusy(true);
    setFeedback('Preparing your profile picture…');
    try {
      const optimized = await optimizeAvatar(file);
      if (selection !== avatarSelection.current) return;
      if (optimized.size > MAX_AVATAR_SIZE) {
        event.target.value = '';
        setAvatarFile(null);
        setAvatarPreview(profile.avatarUrl);
        setFeedback("We couldn't optimize that photo below the 2 MB maximum. Please choose another image.");
        return;
      }
      setAvatarFile(optimized);
      setRemoveAvatar(false);
      setAvatarPreview(URL.createObjectURL(optimized));
      setFeedback(optimized === file ? 'Profile picture ready.' : 'Profile picture optimized and ready.');
    } catch {
      if (selection !== avatarSelection.current) return;
      event.target.value = '';
      setAvatarFile(null);
      setAvatarPreview(profile.avatarUrl);
      setFeedback("That image couldn't be read. Please choose another PNG, JPG, or WebP image.");
    } finally {
      if (selection === avatarSelection.current) setAvatarBusy(false);
    }
  }

  function toggleFeatured(postId: string) {
    setSelectedFeatured(current => {
      if (current.includes(postId)) return current.filter(id => id !== postId);
      if (current.length >= 3) { setFeedback('You can feature up to 3 Skillshots.'); return current; }
      setFeedback('');
      return [...current, postId];
    });
  }

  function validateSocialLinks() {
    const normalized = {} as Record<SocialPlatformKey, string>;
    const errors: Partial<Record<SocialPlatformKey, string>> = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const value = socialValues[platform.key].trim();
      if (!value) { normalized[platform.key] = ''; continue; }
      try {
        normalized[platform.key] = normalizeSocialUrl(platform.key, value);
      } catch {
        const original = String(profile.socialLinks[platform.key] || '').trim();
        if (value === original) normalized[platform.key] = original;
        else errors[platform.key] = `Enter a valid ${platform.label} profile URL.`;
      }
    }
    setSocialErrors(errors);
    return Object.keys(errors).length ? null : normalized;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (avatarBusy) { setFeedback('Please wait while your profile picture is prepared.'); return; }
    const normalizedSocialLinks = validateSocialLinks();
    if (!normalizedSocialLinks) { setFeedback('Check the highlighted social links and try again.'); return; }
    setBusy(true);
    setFeedback(avatarFile ? 'Uploading your profile picture…' : 'Saving your profile…');
    const data = new FormData(form);
    for (const platform of SOCIAL_PLATFORMS) data.set(platform.key, normalizedSocialLinks[platform.key]);
    data.delete('avatar');
    if (avatarFile && !removeAvatar) data.set('avatar', avatarFile);
    try {
      const response = await fetch('/api/profile', { method: 'POST', body: data });
      const destination = new URL(response.url, window.location.origin);
      const error = destination.searchParams.get('error');
      if (error) {
        const messages: Record<string, string> = {
          'avatar-size': 'Profile picture must be smaller than 2 MB.',
          'avatar-type': 'Unsupported image format. Use PNG, JPG, or WebP.',
          'avatar-invalid': "That image couldn't be read. Please choose another PNG, JPG, or WebP image.",
          'avatar-upload': "Couldn't upload your profile picture. Please try again.",
        };
        setFeedback(messages[error] || 'Your profile could not be saved. Please check the fields and try again.');
        setBusy(false);
        return;
      }
      if (!response.ok) throw new Error('Profile save failed');
      window.location.assign(response.url || '/profile?saved=1');
    } catch {
      setFeedback("Couldn't save your profile. Check your connection and try again.");
      setBusy(false);
    }
  }

  return <form action="/api/profile" method="post" encType="multipart/form-data" onSubmit={submit}>
    <fieldset className="avatarEditor">
      <legend>Profile picture</legend>
      <div className="avatarPreview">{avatarPreview ? <img src={avatarPreview} alt="Avatar preview" onError={() => setAvatarPreview('')}/> : <span>{initials(displayName)}</span>}</div>
      <div><label className="avatarUploadButton">{avatarBusy ? 'Preparing…' : 'Choose image'}<input key={avatarInputKey} name="avatar" type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarBusy || busy} onChange={selectAvatar}/></label><small>PNG, JPG, or WebP · automatically optimized · saved avatar maximum 2 MB</small></div>
      {(avatarPreview || profile.avatarUrl) && <button type="button" className="removeAvatarButton" disabled={avatarBusy || busy} onClick={() => { avatarSelection.current += 1; setAvatarFile(null); setAvatarInputKey(value => value + 1); setAvatarPreview(''); setRemoveAvatar(true); setAvatarBusy(false); setFeedback('Profile picture will be removed when you save.'); }}>Remove</button>}
      <input type="hidden" name="removeAvatar" value={removeAvatar ? '1' : '0'}/>
    </fieldset>
    <label>Display name<input required name="displayName" maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)}/></label>
    <label>Username<span className="inputPrefix"><b>@</b><input required name="username" maxLength={30} pattern="[a-zA-Z0-9_-]+" title="Use letters, numbers, underscores, or hyphens." defaultValue={profile.username}/></span></label>
    <label>Professional bio<textarea name="bio" maxLength={500} defaultValue={profile.bio} placeholder="What do you create, and what are you great at?"/></label>
    <label>Location<input name="location" maxLength={100} defaultValue={profile.location} placeholder="City, Country"/></label>
    <label>Profile skills<input name="skills" maxLength={400} defaultValue={profile.skills.join(', ')} placeholder="UI/UX, React, Photography"/><small>These describe your creator profile, not individual Skillshot titles. Separate skills with commas. Up to 12 skills.</small></label>
    <label>Website<input name="website" type="url" maxLength={300} defaultValue={profile.website} placeholder="https://yourportfolio.com"/></label>
    <fieldset className="socialEditor"><legend>Social links</legend>
      <p className="socialHelp">Optional profile links. You can enter them with or without https://.</p>
      {SOCIAL_PLATFORMS.map(platform => {
        const errorId = `${platform.key}-error`;
        return <div className="socialField" key={platform.key}>
          <label htmlFor={`social-${platform.key}`}>{platform.label}</label>
          <div className={`socialInput ${socialErrors[platform.key] ? 'hasError' : ''}`}>
            <span className="socialInputIcon"><SocialIcon platform={platform.key}/></span>
            <input id={`social-${platform.key}`} name={platform.key} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={socialValues[platform.key]} placeholder={platform.placeholder} aria-invalid={Boolean(socialErrors[platform.key])} aria-describedby={socialErrors[platform.key] ? errorId : undefined} onChange={event => { setSocialValues(current => ({ ...current, [platform.key]: event.target.value })); setSocialErrors(current => ({ ...current, [platform.key]: undefined })); }} onBlur={validateSocialLinks}/>
          </div>
          {socialErrors[platform.key] && <p className="socialError" id={errorId} role="alert">{socialErrors[platform.key]}</p>}
        </div>;
      })}
    </fieldset>
    <fieldset className="featuredEditor"><legend>Featured Skillshots <small>{selectedFeatured.length}/3 selected</small></legend>
      {posts.length ? <div className="featuredChoices">{posts.map(post => <label key={post.id} className={selectedFeatured.includes(post.id) ? 'selected' : ''}><input type="checkbox" name="featuredPost" value={post.id} checked={selectedFeatured.includes(post.id)} onChange={() => toggleFeatured(post.id)}/><span>✓</span><b>{post.title}</b></label>)}</div> : <p>Publish your first Skillshot, then return here to feature your best work.</p>}
    </fieldset>
    <p className="editorFeedback" role="status" aria-live="polite">{feedback}</p>
    <div className="editorActions"><button className="primary" disabled={busy || avatarBusy}>{busy ? (avatarFile ? 'Uploading…' : 'Saving…') : avatarBusy ? 'Preparing image…' : 'Save changes'}</button><Link className="quietButton" href="/profile">Cancel</Link></div>
  </form>;
}

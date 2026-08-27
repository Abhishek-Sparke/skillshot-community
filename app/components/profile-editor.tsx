'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';

type EditorProfile = {
  displayName: string; username: string; bio: string; website: string; location: string;
  skills: string[]; socialLinks: Record<string, string>; avatarUrl: string;
};
type EditorPost = { id: string; title: string; featured: boolean };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (avatarBusy) { setFeedback('Please wait while your profile picture is prepared.'); return; }
    setBusy(true);
    setFeedback(avatarFile ? 'Uploading your profile picture…' : 'Saving your profile…');
    const data = new FormData(form);
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
      <label>GitHub<input name="github" type="url" defaultValue={profile.socialLinks.github || ''} placeholder="https://github.com/username"/></label>
      <label>Instagram<input name="instagram" type="url" defaultValue={profile.socialLinks.instagram || ''} placeholder="https://instagram.com/username"/></label>
      <label>LinkedIn<input name="linkedin" type="url" defaultValue={profile.socialLinks.linkedin || ''} placeholder="https://linkedin.com/in/username"/></label>
    </fieldset>
    <fieldset className="featuredEditor"><legend>Featured Skillshots <small>{selectedFeatured.length}/3 selected</small></legend>
      {posts.length ? <div className="featuredChoices">{posts.map(post => <label key={post.id} className={selectedFeatured.includes(post.id) ? 'selected' : ''}><input type="checkbox" name="featuredPost" value={post.id} checked={selectedFeatured.includes(post.id)} onChange={() => toggleFeatured(post.id)}/><span>✓</span><b>{post.title}</b></label>)}</div> : <p>Publish your first Skillshot, then return here to feature your best work.</p>}
    </fieldset>
    <p className="editorFeedback" role="status" aria-live="polite">{feedback}</p>
    <div className="editorActions"><button className="primary" disabled={busy || avatarBusy}>{busy ? (avatarFile ? 'Uploading…' : 'Saving…') : avatarBusy ? 'Preparing image…' : 'Save changes'}</button><Link className="quietButton" href="/profile">Cancel</Link></div>
  </form>;
}

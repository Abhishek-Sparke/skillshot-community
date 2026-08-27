'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

type EditorProfile = {
  displayName: string; username: string; bio: string; website: string; location: string;
  skills: string[]; socialLinks: Record<string, string>; avatarUrl: string;
};
type EditorPost = { id: string; title: string; featured: boolean };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}

export default function ProfileEditor({ profile, posts }: { profile: EditorProfile; posts: EditorPost[] }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [selectedFeatured, setSelectedFeatured] = useState(posts.filter(post => post.featured).map(post => post.id).slice(0, 3));
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      event.target.value = '';
      setFeedback('Choose a PNG, JPG, or WebP avatar smaller than 2 MB.');
      return;
    }
    setFeedback('');
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function toggleFeatured(postId: string) {
    setSelectedFeatured(current => {
      if (current.includes(postId)) return current.filter(id => id !== postId);
      if (current.length >= 3) { setFeedback('You can feature up to 3 Skillshots.'); return current; }
      setFeedback('');
      return [...current, postId];
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!event.currentTarget.checkValidity()) return;
    setBusy(true);
    setFeedback('Saving your profile…');
  }

  return <form action="/api/profile" method="post" encType="multipart/form-data" onSubmit={submit}>
    <fieldset className="avatarEditor">
      <legend>Profile picture</legend>
      <div className="avatarPreview">{avatarPreview ? <img src={avatarPreview} alt="Avatar preview" onError={() => setAvatarPreview('')}/> : <span>{initials(displayName)}</span>}</div>
      <div><label className="avatarUploadButton">Choose image<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar}/></label><small>PNG, JPG, or WebP · maximum 2 MB</small></div>
      {(avatarPreview || profile.avatarUrl) && <button type="button" className="removeAvatarButton" onClick={() => { setAvatarPreview(''); setRemoveAvatar(true); }}>Remove</button>}
      <input type="hidden" name="removeAvatar" value={removeAvatar ? '1' : '0'}/>
    </fieldset>
    <label>Display name<input required name="displayName" maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)}/></label>
    <label>Username<span className="inputPrefix"><b>@</b><input required name="username" maxLength={30} pattern="[a-zA-Z0-9_]+" defaultValue={profile.username}/></span></label>
    <label>Professional bio<textarea name="bio" maxLength={500} defaultValue={profile.bio} placeholder="What do you create, and what are you great at?"/></label>
    <label>Location<input name="location" maxLength={100} defaultValue={profile.location} placeholder="City, Country"/></label>
    <label>Skills<input name="skills" maxLength={400} defaultValue={profile.skills.join(', ')} placeholder="UI/UX, React, Photography"/><small>Separate skills with commas. Up to 12 skills.</small></label>
    <label>Website<input name="website" type="url" maxLength={300} defaultValue={profile.website} placeholder="https://yourportfolio.com"/></label>
    <fieldset className="socialEditor"><legend>Social links</legend>
      <label>GitHub<input name="github" type="url" defaultValue={profile.socialLinks.github || ''} placeholder="https://github.com/username"/></label>
      <label>Instagram<input name="instagram" type="url" defaultValue={profile.socialLinks.instagram || ''} placeholder="https://instagram.com/username"/></label>
      <label>LinkedIn<input name="linkedin" type="url" defaultValue={profile.socialLinks.linkedin || ''} placeholder="https://linkedin.com/in/username"/></label>
    </fieldset>
    <fieldset className="featuredEditor"><legend>Featured Skillshots <small>{selectedFeatured.length}/3 selected</small></legend>
      {posts.length ? <div className="featuredChoices">{posts.map(post => <label key={post.id} className={selectedFeatured.includes(post.id) ? 'selected' : ''}><input type="checkbox" name="featuredPost" value={post.id} checked={selectedFeatured.includes(post.id)} onChange={() => toggleFeatured(post.id)}/><span>✓</span><b>{post.title}</b></label>)}</div> : <p>Publish your first Skillshot, then return here to feature your best work.</p>}
    </fieldset>
    <p className="editorFeedback" role="status">{feedback}</p>
    <div className="editorActions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><Link className="quietButton" href="/profile">Cancel</Link></div>
  </form>;
}

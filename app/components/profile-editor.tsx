'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { normalizeSocialUrl, SOCIAL_PLATFORMS, type SocialPlatformKey } from '../../lib/social-links';

type EditorProfile = {
  displayName: string; username: string; bio: string; website: string; location: string;
  skills: string[]; socialLinks: Record<string, string>; avatarUrl: string; bannerUrl?: string;
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

const MAX_SOURCE_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_SOURCE_BANNER_SIZE = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const BANNER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export default function ProfileEditor({
  profile,
  posts,
  initialTab = 'info',
}: {
  profile: EditorProfile;
  posts: EditorPost[];
  initialTab?: 'info' | 'appearance';
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'appearance'>(initialTab);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [bannerPreview, setBannerPreview] = useState(profile.bannerUrl || '');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerInputKey, setBannerInputKey] = useState(0);
  const [removeBanner, setRemoveBanner] = useState(false);

  const [selectedFeatured, setSelectedFeatured] = useState(posts.filter(post => post.featured).map(post => post.id).slice(0, 3));
  const [socialValues, setSocialValues] = useState<Record<SocialPlatformKey, string>>(() => Object.fromEntries(SOCIAL_PLATFORMS.map(platform => [platform.key, profile.socialLinks[platform.key] || ''])) as Record<SocialPlatformKey, string>);
  const [socialErrors, setSocialErrors] = useState<Partial<Record<SocialPlatformKey, string>>>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const avatarSelection = useRef(0);
  const bannerSelection = useRef(0);

  useEffect(() => () => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    if (bannerPreview.startsWith('blob:')) URL.revokeObjectURL(bannerPreview);
  }, [avatarPreview, bannerPreview]);

  async function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const selection = ++avatarSelection.current;
    if (!AVATAR_TYPES.has(file.type)) {
      event.target.value = '';
      setAvatarFile(null);
      setAvatarPreview(profile.avatarUrl);
      setFeedback('Please upload a PNG, JPG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_SOURCE_AVATAR_SIZE) {
      event.target.value = '';
      setAvatarFile(null);
      setAvatarPreview(profile.avatarUrl);
      setFeedback('Avatar is too large. Please choose an image of 2 MB or less.');
      return;
    }

    setAvatarBusy(true);
    setFeedback('Preparing profile picture…');
    try {
      if (selection !== avatarSelection.current) return;
      setAvatarFile(file);
      setRemoveAvatar(false);
      setAvatarPreview(URL.createObjectURL(file));
      setFeedback('Profile picture ready (animated GIFs will stay animated).');
    } finally {
      if (selection === avatarSelection.current) setAvatarBusy(false);
    }
  }

  async function selectBanner(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const selection = ++bannerSelection.current;
    if (!BANNER_TYPES.has(file.type)) {
      event.target.value = '';
      setBannerFile(null);
      setBannerPreview(profile.bannerUrl || '');
      setFeedback('Please upload a PNG, JPG, WebP, or GIF banner.');
      return;
    }
    if (file.size > MAX_SOURCE_BANNER_SIZE) {
      event.target.value = '';
      setBannerFile(null);
      setBannerPreview(profile.bannerUrl || '');
      setFeedback('Banner is too large. Please choose an image of 5 MB or less.');
      return;
    }

    setBannerBusy(true);
    setFeedback('Preparing banner…');
    try {
      if (selection !== bannerSelection.current) return;
      setBannerFile(file);
      setRemoveBanner(false);
      setBannerPreview(URL.createObjectURL(file));
      setFeedback('Banner ready (animated GIFs will loop continuously).');
    } finally {
      if (selection === bannerSelection.current) setBannerBusy(false);
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
    const nextErrors: Partial<Record<SocialPlatformKey, string>> = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const raw = socialValues[platform.key]?.trim();
      if (!raw) continue;
      try {
        normalizeSocialUrl(platform.key, raw);
      } catch {
        nextErrors[platform.key] = `Please enter a valid ${platform.label} link.`;
      }
    }
    setSocialErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateSocialLinks()) {
      setFeedback('Please fix the invalid social links before saving.');
      return;
    }
    setBusy(true);
    setUploadProgress(0);
    setFeedback('Saving profile changes…');

    const form = event.currentTarget;
    const data = new FormData(form);

    data.delete('avatar');
    if (avatarFile && !removeAvatar) data.set('avatar', avatarFile);

    data.delete('banner');
    if (bannerFile && !removeBanner) data.set('banner', bannerFile);

    try {
      const response = await new Promise<{ url: string; ok: boolean }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', '/api/profile');
        request.timeout = 120_000;
        request.upload.onprogress = ev => {
          if (!ev.lengthComputable) return;
          const progress = Math.round(ev.loaded / ev.total * 100);
          setUploadProgress(progress);
          setFeedback(`Saving profile changes… ${progress}%`);
        };
        request.onload = () => resolve({ url: request.responseURL, ok: request.status >= 200 && request.status < 300 });
        request.onerror = () => reject(new Error('Network error'));
        request.ontimeout = () => reject(new Error('Upload timeout'));
        request.send(data);
      });
      const destination = new URL(response.url, window.location.origin);
      const error = destination.searchParams.get('error');
      if (error) {
        const messages: Record<string, string> = {
          username: 'Please choose a valid username.',
          'username-taken': 'That username is already taken.',
          website: 'Website must begin with http:// or https://.',
          social: 'Enter valid GitHub, Instagram, or LinkedIn profile URLs.',
          'social-github': 'Enter a valid GitHub profile URL.',
          'social-instagram': 'Enter a valid Instagram profile URL.',
          'social-linkedin': 'Enter a valid LinkedIn profile URL.',
          avatar: 'Choose a PNG, JPG, or WebP image. Your saved avatar has a 2 MB maximum and is optimized automatically.',
          'avatar-size': 'Avatar is too large. Please choose an image of 2 MB or less.',
          'avatar-type': 'Please upload a PNG, JPG, WebP, or GIF image.',
          'avatar-rate': 'You have changed your profile picture several times today. Please try again later.',
          'avatar-invalid': "That image couldn't be read. Please choose another image or GIF.",
          'avatar-upload': "Couldn't upload your profile picture. Please try again.",
          'avatar-moderation': 'This profile image could not be approved. Try another image or contact the team.',
          'banner-size': 'Banner is too large. Please choose an image of 5 MB or less.',
          'banner-type': 'Please upload a PNG, JPG, WebP, or GIF banner.',
          'banner-invalid': "That banner couldn't be read. Please choose another image or GIF.",
          'banner-upload': "Couldn't upload your banner. Please try again.",
          'banner-moderation': 'This banner could not be approved. Try another image or contact the team.',
          save: 'Your profile could not be saved. Please try again.',
        };
        if (error === 'username' || error === 'username-taken' || error === 'website' || error.startsWith('social')) {
          setActiveTab('info');
          if (error.startsWith('social-')) {
            const platformKey = error.replace('social-', '') as SocialPlatformKey;
            setSocialErrors(prev => ({ ...prev, [platformKey]: messages[error] }));
          }
        } else if (error.startsWith('avatar') || error.startsWith('banner')) {
          setActiveTab('appearance');
        }
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

  return (
    <form action="/api/profile" method="post" encType="multipart/form-data" onSubmit={submit}>
      {/* Editor Sub-Navigation Tabs */}
      <div className="editorSubTabs">
        <button
          type="button"
          className={`editorSubTab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Profile Information
        </button>
        <button
          type="button"
          className={`editorSubTab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          Profile Appearance (PFP & Banner)
        </button>
      </div>

      <div className="appearanceSection" style={{ display: activeTab === 'appearance' ? 'block' : 'none' }}>
        {/* Live Preview Card */}
        <div className="appearanceLivePreview">
            <h4>Live Appearance Preview</h4>
            <div className="previewCoverWrap">
              {bannerPreview && !removeBanner ? (
                <img src={bannerPreview} alt="Banner preview" className="previewBannerImg" />
              ) : (
                <div className="previewBannerFallback"><span>SKILLSHOT CREATOR</span></div>
              )}
              <div className="previewBannerOverlay" />
              <div className="previewAvatarWrap">
                {avatarPreview && !removeAvatar ? (
                  <img src={avatarPreview} alt="Avatar preview" className="previewAvatarImg animatedPfp" />
                ) : (
                  <span className="previewAvatarFallback">{initials(displayName)}</span>
                )}
              </div>
            </div>
            <div className="previewIdentityRow">
              <strong>{displayName || 'Creator Name'}</strong>
              <span>@{profile.username}</span>
            </div>
          </div>

          {/* Banner Upload Controls */}
          <fieldset className="appearanceFieldset">
            <legend>Profile Banner (GIF or Static Image)</legend>
            <p className="appearanceHint">Recommended: 1920 × 600 px. Max 5 MB. Animated GIFs loop continuously.</p>
            <div className="appearanceToolsRow">
              <label className="primary uploadToolBtn">
                {bannerBusy ? 'Preparing…' : 'Change Banner'}
                <input
                  key={bannerInputKey}
                  name="banner"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={bannerBusy || busy}
                  onChange={selectBanner}
                />
              </label>
              {(bannerPreview || profile.bannerUrl) && !removeBanner && (
                <button
                  type="button"
                  className="quietButton"
                  onClick={() => {
                    bannerSelection.current += 1;
                    setBannerFile(null);
                    setBannerInputKey(v => v + 1);
                    setBannerPreview('');
                    setRemoveBanner(true);
                    setFeedback('Banner will be removed when you save.');
                  }}
                >
                  Remove Banner
                </button>
              )}
            </div>
            <input type="hidden" name="removeBanner" value={removeBanner ? '1' : '0'} />
          </fieldset>

          {/* Profile Picture Upload Controls */}
          <fieldset className="appearanceFieldset">
            <legend>Profile Picture (GIF or Static Image)</legend>
            <p className="appearanceHint">PNG, JPG, WebP, or GIF · 2 MB max. Animated GIFs stay animated everywhere.</p>
            <div className="appearanceToolsRow">
              <label className="primary uploadToolBtn">
                {avatarBusy ? 'Preparing…' : 'Change PFP'}
                <input
                  key={avatarInputKey}
                  name="avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={avatarBusy || busy}
                  onChange={selectAvatar}
                />
              </label>
              {(avatarPreview || profile.avatarUrl) && !removeAvatar && (
                <button
                  type="button"
                  className="quietButton"
                  onClick={() => {
                    avatarSelection.current += 1;
                    setAvatarFile(null);
                    setAvatarInputKey(v => v + 1);
                    setAvatarPreview('');
                    setRemoveAvatar(true);
                    setFeedback('Profile picture will be removed when you save.');
                  }}
                >
                  Remove PFP
                </button>
              )}
            </div>
            <input type="hidden" name="removeAvatar" value={removeAvatar ? '1' : '0'} />
          </fieldset>
        </div>

        <div className="infoSection" style={{ display: activeTab === 'info' ? 'block' : 'none' }}>
          <div className="editorMediaShortcutCard">
            <div className="editorMediaShortcutPreview">
              <div className="editorMediaShortcutAvatar">
                {avatarPreview && !removeAvatar ? (
                  <img src={avatarPreview} alt="Avatar" className="animatedPfp" />
                ) : (
                  <span>{initials(displayName)}</span>
                )}
              </div>
              <div className="editorMediaShortcutMeta">
                <strong>Profile Picture & Banner</strong>
                <span>Personalize your avatar and banner (GIF or static image)</span>
              </div>
            </div>
            <button
              type="button"
              className="secondary editorMediaShortcutBtn"
              onClick={() => setActiveTab('appearance')}
            >
              Edit PFP & Banner →
            </button>
          </div>
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
        </div>

      <p className="editorFeedback" role="status" aria-live="polite">{feedback}</p>
      {busy && (avatarFile || bannerFile) && (
        <div className="uploadProgress" role="progressbar" aria-label="Media upload" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
          <span style={{ width: `${uploadProgress}%` }}/>
        </div>
      )}
      <div className="editorActions">
        <button className="primary" disabled={busy || avatarBusy || bannerBusy}>
          {busy ? 'Saving changes…' : avatarBusy || bannerBusy ? 'Preparing media…' : 'Save changes'}
        </button>
        <Link className="quietButton" href="/profile">Cancel</Link>
      </div>
    </form>
  );
}

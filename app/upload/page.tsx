'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { upload } from '@vercel/blob/client';
import { requireClientAuth } from '../../lib/auth-path';
import { IMAGE_TYPES, SKILLSHOT_MAX_BYTES as MAX_IMAGE_SIZE } from '../../lib/upload-policy';

const CATEGORIES = ['Gaming', 'Development', 'Design', 'Photography', 'Art', 'Creative', 'Projects', 'Other'];

export default function Upload() {
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) { event.target.value = ''; setPreview(''); setStatus('Please upload a PNG, JPG, or WebP image.'); return; }
    if (file.size > MAX_IMAGE_SIZE) { event.target.value = ''; setPreview(''); setStatus('Image is too large. Please choose an image smaller than 10 MB.'); return; }
    setStatus('');
    setPreview(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const image = new FormData(form).get('image');
    if (!(image instanceof File) || !IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE) {
      setStatus(image instanceof File && image.size > MAX_IMAGE_SIZE ? 'Image is too large. Please choose an image smaller than 10 MB.' : 'Please upload a PNG, JPG, or WebP image.');
      return;
    }

    if (busy) return;
    setBusy(true);
    setProgress(0); setStatus('Uploading…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 300_000);
    try {
      const extension = image.type === 'image/png' ? 'png' : image.type === 'image/jpeg' ? 'jpg' : 'webp';
      const staged = await upload(`staging/${crypto.randomUUID()}.${extension}`, image, {
        access: 'private', handleUploadUrl: '/api/uploads', contentType: image.type,
        abortSignal: controller.signal,
        onUploadProgress: event => { setProgress(Math.round(event.percentage)); },
      });
      setStatus('Checking and optimizing image…');
      const values = new FormData(form);
      const response = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ pathname: staged.pathname, title: values.get('title'), description: values.get('description'), skills: values.get('skills'), tags: values.get('tags'), category: values.get('category') }),
      });
      if (response.status === 401) { requireClientAuth(false, '/upload', 'Sign in to publish your Skillshot'); return; }
      const result = await response.json();
      if (!response.ok || !result.id) { setStatus(result.error || 'Upload failed. Please try again.'); return; }
      setProgress(100);
      setStatus(result.status === 'VISIBLE' ? '✓ Upload complete' : '✓ Uploaded and awaiting a safety review');
      window.setTimeout(() => window.location.assign(`/shots/${result.id}`), 500);
    } catch {
      setStatus(controller.signal.aborted ? 'The upload timed out. Check your connection and try again.' : !navigator.onLine ? 'Network error. Check your connection and try again.' : 'Upload failed. Check your sign-in and connection, then try again.');
    } finally { window.clearTimeout(timeout); setBusy(false); }
  }

  return <main className="formPage">
    <Link className="brand" href="/"><span>S</span> Skillshot</Link>
    <section className="formCard createCard">
      <p className="eyebrow">CREATE A SKILLSHOT</p>
      <h1>What are you sharing?</h1>
      <p className="createIntro">Show something you&apos;ve created, built, captured, discovered, or are proud of.</p>
      <div className="createLayout"><form onSubmit={submit}>
        <label className="drop">
          {preview ? <img src={preview} alt="Selected Skillshot preview"/> : <><b>Upload your Skillshot</b><small>PNG, JPG/JPEG or WebP · 10 MB maximum</small></>}
          <input required name="image" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/>
        </label>
        <label>Title<input required name="title" maxLength={100} placeholder="What should we call this?" value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label>Description<textarea name="description" maxLength={1000} placeholder="Tell people about it..." value={description} onChange={event => setDescription(event.target.value)}/></label>
        <label>Skills<input name="skills" maxLength={300} placeholder="Add skills..." value={skills} onChange={event => setSkills(event.target.value)}/><small>Separate skills with commas.</small></label>
        <label>Tags<input name="tags" maxLength={300} placeholder="Add tags..."/></label>
        <label>Category <small>(optional)</small><select name="category" value={category} onChange={event => setCategory(event.target.value)}><option value="">Choose a category</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish shot →'}</button>
        {busy && <div className="uploadProgress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`Upload ${progress}%`}><span style={{ width: `${progress}%` }}/></div>}
        <p role="status" aria-live="polite">{status}{busy && status === 'Uploading…' ? ` ${progress}%` : ''}</p>
      </form><aside className="livePreview"><p className="eyebrow">LIVE PREVIEW</p><article><div className="previewImage">{preview ? <img src={preview} alt="Skillshot card preview"/> : <span>Your image preview</span>}</div><div><h2>{title || 'Your Skillshot title'}</h2><p>{description || 'Tell the community what makes this worth sharing.'}</p>{skills && <div className="previewSkills">{skills.split(',').filter(Boolean).slice(0,3).map(item => <span key={item}>{item.trim()}</span>)}</div>}</div></article></aside></div>
      <Link className="backHome" href="/">← Back to home</Link>
      <Link className="quietLink" href="/my-posts">View my posts</Link>
    </section>
  </main>;
}

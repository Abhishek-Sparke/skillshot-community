'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
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

    setBusy(true);
    setProgress(0); setStatus('Uploading…');
    const request = new XMLHttpRequest();
    request.open('POST', '/api/posts');
    request.upload.onprogress = event => { if (event.lengthComputable) { const value = Math.round(event.loaded / event.total * 100); setProgress(value); if (value >= 100) setStatus('Optimizing image…'); } };
    request.onerror = () => { setStatus('Network error. Check your connection and try again.'); setBusy(false); };
    request.onload = () => {
      let result: { id?: string; status?: string; error?: string } = {};
      try { result = JSON.parse(request.responseText); } catch {}
      if (request.status >= 200 && request.status < 300 && result.id) {
        setProgress(100); setStatus(result.status === 'VISIBLE' ? '✓ Upload complete' : '✓ Uploaded and awaiting a quick safety review');
        window.setTimeout(() => window.location.assign(`/shots/${result.id}`), 500);
      } else { setStatus(request.status === 401 ? 'Please sign in before publishing your Skillshot.' : result.error || 'Upload failed. Please try again.'); setBusy(false); }
    };
    request.send(new FormData(form));
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
        {busy && <div className="uploadProgress" aria-label={`Upload ${progress}%`}><span style={{ width: `${progress}%` }}/></div>}
        <p role="status" aria-live="polite">{status}{busy && status === 'Uploading…' ? ` ${progress}%` : ''}</p>
      </form><aside className="livePreview"><p className="eyebrow">LIVE PREVIEW</p><article><div className="previewImage">{preview ? <img src={preview} alt="Skillshot card preview"/> : <span>Your image preview</span>}</div><div><h2>{title || 'Your Skillshot title'}</h2><p>{description || 'Tell the community what makes this worth sharing.'}</p>{skills && <div className="previewSkills">{skills.split(',').filter(Boolean).slice(0,3).map(item => <span key={item}>{item.trim()}</span>)}</div>}</div></article></aside></div>
      <Link className="backHome" href="/">← Back to home</Link>
      <Link className="quietLink" href="/my-posts">View my posts</Link>
    </section>
  </main>;
}

'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { upload } from '@vercel/blob/client';
import { requireClientAuth } from '../../lib/auth-path';
import { IMAGE_TYPES, SKILLSHOT_MAX_BYTES as MAX_IMAGE_SIZE } from '../../lib/upload-policy';

const CATEGORIES = ['Gaming', 'Development', 'Design', 'Photography', 'Art', 'Creative', 'Projects', 'Other'];

export default function Upload() {
  const [preview, setPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<'original'|'square'|'landscape'>('original');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) { event.target.value = ''; setPreview(''); setSelectedFile(null); setStatus('Please upload a PNG, JPG, or WebP image.'); return; }
    if (file.size > MAX_IMAGE_SIZE) { event.target.value = ''; setPreview(''); setSelectedFile(null); setStatus('Image is too large. Please choose an image smaller than 10 MB.'); return; }
    setStatus('');
    setSelectedFile(file); setRotation(0); setCrop('original');
    setPreview(URL.createObjectURL(file));
  }

  async function transformImage(file: File) {
    if (rotation === 0 && crop === 'original') return file;
    const bitmap = await createImageBitmap(file);
    let sourceWidth = bitmap.width, sourceHeight = bitmap.height, sourceX = 0, sourceY = 0;
    const ratio = crop === 'square' ? 1 : crop === 'landscape' ? 4 / 3 : bitmap.width / bitmap.height;
    if (sourceWidth / sourceHeight > ratio) { sourceWidth = Math.round(sourceHeight * ratio); sourceX = Math.round((bitmap.width - sourceWidth) / 2); }
    else if (sourceWidth / sourceHeight < ratio) { sourceHeight = Math.round(sourceWidth / ratio); sourceY = Math.round((bitmap.height - sourceHeight) / 2); }
    if (sourceWidth * sourceHeight > 40_000_000) { bitmap.close(); throw new Error('EDIT_TOO_LARGE'); }
    const turn = ((rotation % 360) + 360) % 360;
    const canvas = document.createElement('canvas');
    canvas.width = turn === 90 || turn === 270 ? sourceHeight : sourceWidth;
    canvas.height = turn === 90 || turn === 270 ? sourceWidth : sourceHeight;
    const context = canvas.getContext('2d'); if (!context) throw new Error('EDIT_FAILED');
    context.translate(canvas.width / 2, canvas.height / 2); context.rotate(turn * Math.PI / 180);
    context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight); bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, file.type, .92));
    if (!blob) throw new Error('EDIT_FAILED');
    return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
  }

  function resetImage(){setRotation(0);setCrop('original');setStatus('Image edits reset.');}

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const inputImage = selectedFile ?? new FormData(form).get('image');
    if (!(inputImage instanceof File) || !IMAGE_TYPES.has(inputImage.type) || inputImage.size > MAX_IMAGE_SIZE) {
      setStatus(inputImage instanceof File && inputImage.size > MAX_IMAGE_SIZE ? 'Image is too large. Please choose an image smaller than 10 MB.' : 'Please upload a PNG, JPG, or WebP image.');
      return;
    }

    if (busy) return;
    setBusy(true);
    setProgress(0); setStatus('Uploading…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 300_000);
    try {
      setStatus(rotation || crop !== 'original' ? 'Preparing image edits…' : 'Uploading…');
      const image = await transformImage(inputImage);
      if (image.size > MAX_IMAGE_SIZE) { setStatus('The edited image is too large. Try the original crop or a smaller image.'); return; }
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
          {preview ? <span className={`editablePreview crop-${crop}`}><img src={preview} style={{transform:`rotate(${rotation}deg)`}} alt="Selected Skillshot preview"/></span> : <><b>Upload your Skillshot</b><small>PNG, JPG/JPEG or WebP · 10 MB maximum</small></>}
          <input required name="image" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/>
        </label>
        {preview && <div className="imageEditTools" aria-label="Image adjustments"><span>Crop</span><button type="button" className={crop==='original'?'active':''} onClick={()=>setCrop('original')}>Original</button><button type="button" className={crop==='square'?'active':''} onClick={()=>setCrop('square')}>Square</button><button type="button" className={crop==='landscape'?'active':''} onClick={()=>setCrop('landscape')}>4:3</button><button type="button" onClick={()=>setRotation(value=>(value+90)%360)}>↻ Rotate</button><button type="button" onClick={resetImage}>Reset</button></div>}
        <label>Title<input required name="title" maxLength={100} placeholder="What should we call this?" value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label>Description<textarea name="description" maxLength={1000} placeholder="Tell people about it..." value={description} onChange={event => setDescription(event.target.value)}/></label>
        <label>Skills<input name="skills" maxLength={300} placeholder="Add skills..." value={skills} onChange={event => setSkills(event.target.value)}/><small>Separate skills with commas.</small></label>
        <label>Tags<input name="tags" maxLength={300} placeholder="Add tags..." value={tags} onChange={event=>setTags(event.target.value)}/></label>
        <label>Category <small>(optional)</small><select name="category" value={category} onChange={event => setCategory(event.target.value)}><option value="">Choose a category</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish shot →'}</button>
        {busy && <div className="uploadProgress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`Upload ${progress}%`}><span style={{ width: `${progress}%` }}/></div>}
        <p role="status" aria-live="polite">{status}{busy && status === 'Uploading…' ? ` ${progress}%` : ''}</p>
      </form><aside className="livePreview"><p className="eyebrow">LIVE COMMUNITY PREVIEW</p><article><div className={`previewImage crop-${crop}`}>{preview ? <img src={preview} style={{transform:`rotate(${rotation}deg)`}} alt="Skillshot card preview"/> : <span>Your image preview</span>}<i className="previewAvatar">YOU</i></div><div><h2>{title || 'Your Skillshot title'}</h2><small className="previewAuthor">Your profile · @{category || 'creator'}</small><p>{description || 'Tell the community what makes this worth sharing.'}</p><div className="previewSkills">{skills.split(',').filter(Boolean).slice(0,3).map(item => <span key={item}>{item.trim()}</span>)}{category&&<span>{category}</span>}</div><div className="previewCardFooter"><span>{tags.split(',').filter(Boolean).slice(0,2).map(item=>'#'+item.trim()).join(' ')}</span><b>♥ 0 · ◌ 0</b></div></div></article></aside></div>
      <Link className="backHome" href="/">← Back to home</Link>
      <Link className="quietLink" href="/my-posts">View my posts</Link>
    </section>
  </main>;
}

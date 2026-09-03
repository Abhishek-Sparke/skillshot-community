'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { upload } from '@vercel/blob/client';
import { requireClientAuth } from '../../lib/auth-path';
import { SKILLSHOT_TYPES as IMAGE_TYPES, SKILLSHOT_MAX_BYTES as MAX_IMAGE_SIZE } from '../../lib/upload-policy';
import { imageQuality, inspectSelectedImage, prepareSelectedImage, type ImageDimensions, type ImageCrop } from '../../lib/image-quality';

const CATEGORIES = ['Gaming', 'Development', 'Design', 'Photography', 'Art', 'Creative', 'Projects', 'Other'];

export default function Upload() {
  const [preview, setPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceInfo, setSourceInfo] = useState<ImageDimensions | null>(null);
  const [prepared, setPrepared] = useState<(ImageDimensions & { file: File }) | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [qualityAccepted, setQualityAccepted] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const cropTools = useRef<HTMLDivElement>(null);
  const selectionVersion = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<ImageCrop>('original');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (!selectedFile || !sourceInfo) return;
    let active = true;
    let url = '';
    prepareSelectedImage(selectedFile, sourceInfo, crop, rotation).then(result => {
      if (!active) return;
      url = URL.createObjectURL(result.file);
      setPreview(url); setPrepared(result); setPreparing(false);
    }).catch(error => {
      if (!active) return;
      setStatus(error instanceof Error ? error.message : 'Could not prepare this image. Please choose another.');
      setPreparing(false);
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [selectedFile, sourceInfo, crop, rotation]);

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const version = ++selectionVersion.current;
    setPreview(''); setSelectedFile(null); setPrepared(null); setSourceInfo(null);
    setQualityAccepted(false); setPreparing(true); setStatus('Checking image…');
    try {
      const dimensions = await inspectSelectedImage(file);
      if (version !== selectionVersion.current) return;
      setStatus(''); setSourceInfo(dimensions); setSelectedFile(file); setRotation(0); setCrop('original');
    } catch (error) {
      if (version !== selectionVersion.current) return;
      if (imageInput.current) imageInput.current.value = '';
      setPreparing(false);
      setStatus(file.size > MAX_IMAGE_SIZE ? `⚠ Large image · ${(file.size / (1024 * 1024)).toFixed(1)} MB. Please choose an image of 10 MB or less.` : error instanceof Error ? error.message : 'Could not read this image. Please choose another.');
    }
  }

  function editImage(nextCrop: ImageCrop, nextRotation: number) {
    if (busy || (nextCrop === crop && nextRotation === rotation)) return;
    setPrepared(null); setPreview(''); setPreparing(true); setQualityAccepted(false); setStatus('');
    setCrop(nextCrop); setRotation(nextRotation);
  }

  const quality = prepared ? imageQuality(prepared, prepared.file.size) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const inputImage = prepared?.file;
    if (preparing || !prepared) { setStatus('Please choose a valid image and wait for the image check to finish.'); return; }
    if (!(inputImage instanceof File) || !IMAGE_TYPES.has(inputImage.type) || inputImage.size > MAX_IMAGE_SIZE) {
      setStatus(inputImage instanceof File && inputImage.size > MAX_IMAGE_SIZE ? 'Image is too large. Please choose an image smaller than 10 MB.' : 'Please upload a PNG, JPG, WebP, or GIF image.');
      return;
    }

    if (busy) return;
    setBusy(true);
    setProgress(0); setStatus('Uploading…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 300_000);
    try {
      const image = inputImage;
      if (image.size > MAX_IMAGE_SIZE) { setStatus('The edited image is too large. Try the original crop or a smaller image.'); return; }
      const extension = image.type==='image/gif'?'gif':image.type === 'image/png' ? 'png' : image.type === 'image/jpeg' ? 'jpg' : 'webp';
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
      if (result.status === 'VISIBLE') window.setTimeout(() => window.location.assign(`/shots/${result.id}`), 500);
      else {
        // Held work has no public detail page yet. Do not send the creator to a 404
        // or let another click publish the same selection again.
        setSelectedFile(null); setSourceInfo(null); setPrepared(null); setPreview('');
        if (imageInput.current) imageInput.current.value = '';
      }
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
          {preview ? <span className="editablePreview"><img src={preview} alt="Selected Skillshot preview"/></span> : <><b>{preparing ? 'Checking image…' : 'Upload your Skillshot'}</b><small>PNG, JPG/JPEG, WebP or GIF · 10 MB maximum</small></>}
          <input ref={imageInput} required disabled={busy} name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseImage}/>
        </label>
        {selectedFile && selectedFile.type!=='image/gif' && <div ref={cropTools} tabIndex={-1} className="imageEditTools" aria-label="Image adjustments"><span>Optional center crop</span><button disabled={busy} type="button" className={crop==='original'?'active':''} onClick={()=>editImage('original',rotation)}>Original</button><button disabled={busy} type="button" className={crop==='square'?'active':''} onClick={()=>editImage('square',rotation)}>Square</button><button disabled={busy} type="button" className={crop==='landscape'?'active':''} onClick={()=>editImage('landscape',rotation)}>4:3</button><button disabled={busy} type="button" onClick={()=>editImage(crop,(rotation+90)%360)}>↻ Rotate</button><button disabled={busy} type="button" onClick={()=>editImage('original',0)}>Reset</button></div>}
        <label>Title<input required name="title" maxLength={100} placeholder="What should we call this?" value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label>Description<textarea name="description" maxLength={1000} placeholder="Tell people about it..." value={description} onChange={event => setDescription(event.target.value)}/></label>
        <label>Skills<input name="skills" maxLength={300} placeholder="Add skills..." value={skills} onChange={event => setSkills(event.target.value)}/><small>Separate skills with commas.</small></label>
        <label>Tags<input name="tags" maxLength={300} placeholder="Add tags..." value={tags} onChange={event=>setTags(event.target.value)}/></label>
        <label>Category <small>(optional)</small><select name="category" value={category} onChange={event => setCategory(event.target.value)}><option value="">Choose a category</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        <button className="primary" type="submit" disabled={busy || preparing || !prepared}>{busy ? 'Publishing…' : preparing ? 'Checking image…' : 'Publish shot →'}</button>
        {busy && <div className="uploadProgress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`Upload ${progress}%`}><span style={{ width: `${progress}%` }}/></div>}
        <p role="status" aria-live="polite">{status}{busy && status === 'Uploading…' ? ` ${progress}%` : ''}</p>
      </form><aside className="livePreview">
        <section className="imageQuality" aria-label="Image quality" aria-live="polite" aria-busy={preparing}>
          <h2>Image quality</h2>
          {preparing ? <p>Checking dimensions and preparing your preview…</p> : quality ? <>
            <strong>{quality.label}</strong>
            <p className="imageFacts">{quality.width} × {quality.height} · {quality.ratio} · {quality.fileSize} · {quality.orientation}</p>
            {selectedFile?.type==='image/gif'&&<p>GIF · {sourceInfo?.frames} frames · Animation preserved. Cropping is disabled for animated images.</p>}
            {quality.recommendLarger && <p>For the best quality, consider uploading an image with at least 1200px on the longest side. You can still publish this image.</p>}
            {quality.unusual && <p><b>💡 Unusual aspect ratio</b><br/>The image can still be uploaded, but it may display better after cropping. We never crop it automatically.</p>}
            {!qualityAccepted && (quality.recommendLarger || quality.unusual) && <div className="qualityActions">
              {quality.unusual && selectedFile?.type!=='image/gif' && <button disabled={busy} type="button" onClick={()=>{cropTools.current?.scrollIntoView({block:'center',behavior:'smooth'});cropTools.current?.focus();}}>Crop</button>}
              <button disabled={busy} type="button" onClick={()=>setQualityAccepted(true)}>{quality.unusual ? 'Keep original' : 'Keep image'}</button>
              <button disabled={busy} type="button" onClick={()=>imageInput.current?.click()}>Choose another</button>
            </div>}
            {qualityAccepted && <p>✓ Image kept. Ready to publish.</p>}
            <small>Resolution guidance, not a sharpness guarantee. 1200px+ recommended; 1600–2400px ideal. Skillshot optimizes images for display.</small>
          </> : <><p>{status || 'Choose an image to see its resolution, shape and file size.'}</p>{status && <button type="button" onClick={()=>imageInput.current?.click()}>Choose another</button>}</>}
        </section>
        <p className="eyebrow">LIVE COMMUNITY PREVIEW</p><article><div className="previewImage" style={{aspectRatio:prepared ? `${prepared.width} / ${prepared.height}` : '4 / 3'}}>{preview && prepared ? <img src={preview} width={prepared.width} height={prepared.height} alt="Skillshot card preview"/> : <span>Your image preview</span>}<i className="previewAvatar">YOU</i></div><div><h2>{title || 'Your Skillshot title'}</h2><small className="previewAuthor">Your display name</small><p>{description || 'Tell the community what makes this worth sharing.'}</p><div className="previewSkills">{skills.split(',').filter(Boolean).slice(0,3).map(item => <span key={item}>{item.trim()}</span>)}{category&&<span>{category}</span>}</div><div className="previewCardFooter"><span>{tags.split(',').filter(Boolean).slice(0,2).map(item=>'#'+item.trim()).join(' ')}</span><b>♥ 0 · ◌ 0</b></div></div></article></aside></div>
      <Link className="backHome" href="/">← Back to home</Link>
      <Link className="quietLink" href="/my-posts">View my posts</Link>
    </section>
  </main>;
}

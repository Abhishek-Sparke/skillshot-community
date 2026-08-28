'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export default function Upload() {
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const image = new FormData(form).get('image');
    if (!(image instanceof File) || image.size > MAX_IMAGE_SIZE) {
      setStatus('Choose a PNG, JPG, WebP, or GIF smaller than 10 MB.');
      return;
    }

    setBusy(true);
    setStatus('Uploading…');
    try {
      const response = await fetch('/api/posts', { method: 'POST', body: new FormData(form) });
      if (response.ok) {
        const post = await response.json();
        setStatus(post.status === 'VISIBLE' ? 'Your shot is live! Opening it now…' : 'Your shot was uploaded and is awaiting a quick safety review.');
        window.location.assign(`/shots/${post.id}`);
      } else if (response.status === 401) {
        setStatus('Please sign in before publishing your shot.');
      } else if (response.status === 413) {
        setStatus('That image is too large. The maximum size is 10 MB.');
      } else if (response.status === 400) {
        setStatus('Please choose a valid image and add a title.');
      } else {
        setStatus('The upload could not be completed. Please try again.');
      }
    } catch {
      setStatus('The upload could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="formPage">
    <Link className="brand" href="/"><span>S</span> Skillshot</Link>
    <section className="formCard">
      <p className="eyebrow">SHARE YOUR WORK</p>
      <h1>Put your skills in the frame.</h1>
      <form onSubmit={submit}>
        <label className="drop">
          {preview ? <img src={preview} alt="Selected preview"/> : <><b>Drop your screenshot here</b><small>PNG, JPG, WebP or GIF · up to 10 MB</small></>}
          <input required name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_IMAGE_SIZE) {
              event.target.value = '';
              setPreview('');
              setStatus('That image is too large. The maximum size is 10 MB.');
              return;
            }
            setStatus('');
            setPreview(URL.createObjectURL(file));
          }}/>
        </label>
        <label>Skillshot title<input required name="title" maxLength={100} placeholder="What did you make?"/></label>
        <label>Description<textarea name="description" maxLength={1000} placeholder="Tell us about the idea or process"/></label>
        <label>Skillshot tags<input name="tags" placeholder="UI Design, React, Illustration"/></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish shot →'}</button>
        <p role="status" aria-live="polite">{status}</p>
      </form>
      <Link className="backHome" href="/">← Back to home</Link>
      <Link className="quietLink" href="/my-posts">View my posts</Link>
    </section>
  </main>;
}

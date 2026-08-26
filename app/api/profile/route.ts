import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../lib/db';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.redirect(new URL('/signin?callbackUrl=/profile', request.url), 303);
  await ensureUser(user);
  const form = await request.formData();
  const displayName = String(form.get('displayName') || user.displayName).trim().slice(0, 80) || user.displayName;
  const username = String(form.get('username') || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
  const bio = String(form.get('bio') || '').trim().slice(0, 500);
  const website = String(form.get('website') || '').trim().slice(0, 300);
  if (!username) return NextResponse.redirect(new URL('/profile?error=username', request.url), 303);
  try {
    await (await getReadyDb()).query(`UPDATE users SET display_name=$1,username=$2,bio=$3,website=$4 WHERE id=$5`, [displayName, username, bio, website, user.userId]);
  } catch {
    return NextResponse.redirect(new URL('/profile?error=username-taken', request.url), 303);
  }
  return NextResponse.redirect(new URL('/profile?saved=1', request.url), 303);
}


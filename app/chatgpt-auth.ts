import { redirect } from 'next/navigation';
import { auth } from '../auth';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const name = session?.user?.name?.trim() || null;
  return { userId: email, email, displayName: name ?? email, fullName: name };
}

export async function requireChatGPTUser(returnTo: string) {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string) {
  return '/signin?callbackUrl=' + encodeURIComponent(safePath(returnTo));
}

export function chatGPTSignOutPath(returnTo = '/') {
  return '/api/auth/signout?callbackUrl=' + encodeURIComponent(safePath(returnTo));
}

function safePath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

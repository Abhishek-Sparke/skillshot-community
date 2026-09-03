import type { Metadata } from 'next';
import './globals.css';
import './settings.css';
import ThemeController from './components/theme-controller';
import { getPrincipal } from '../lib/authz';
import { THEMES,type Theme } from '../lib/settings-policy';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Skillshot — Show your skills in one shot',
  description: 'Share screenshots of your best work, discover talented makers, and celebrate the details.',
  openGraph: { title: 'Skillshot — Show your skills in one shot', description: 'Share the work you’re proud of.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Skillshot — Show your skills in one shot', description: 'Share the work you’re proud of.', images: ['/og.png'] },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer=process.env.DATABASE_URL?await getPrincipal():null;
  const saved=(viewer?.profile.preferences as {theme?:Theme}|undefined)?.theme;
  const accountTheme=saved&&THEMES.includes(saved)?saved:null;
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`(()=>{let t=${JSON.stringify(accountTheme)};if(!t){t='system';try{t=localStorage.getItem('skillshot-theme')||t}catch{}}if(!['light','dark','system'].includes(t))t='system';document.documentElement.dataset.preference=t;document.documentElement.dataset.theme=t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`}}/></head>
      <body><ThemeController/>{children}</body>
    </html>
  );
}

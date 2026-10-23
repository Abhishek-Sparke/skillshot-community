import type { Metadata, Viewport } from 'next';
import './globals.css';
import './settings.css';
import ThemeController from './components/theme-controller';
import PullToRefresh from './components/pull-to-refresh';
import KeyboardShortcuts from './components/keyboard-shortcuts';
import CommandPalette from './components/command-palette';
import MobileDock from './components/mobile-dock';
import { getPrincipal } from '../lib/authz';
import { THEMES, type Theme } from '../lib/settings-policy';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Skillshot — Show your skills.',
  description: 'Share screenshots of your best work, discover talented makers, and celebrate the details.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Skillshot',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: { title: 'Skillshot — Show your skills.', description: 'Share the work you’re proud of.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Skillshot — Show your skills.', description: 'Share the work you’re proud of.', images: ['/og.png'] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f6f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0e0d' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = process.env.DATABASE_URL ? await getPrincipal() : null;
  const saved = (viewer?.profile.preferences as { theme?: Theme } | undefined)?.theme;
  const accountTheme = saved && THEMES.includes(saved) ? saved : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: `(()=>{let t=${JSON.stringify(accountTheme)};if(!t){t='system';try{t=localStorage.getItem('skillshot-theme')||t}catch{}}if(!['light','dark','system','halloween','cyberpunk'].includes(t))t='system';document.documentElement.dataset.preference=t;document.documentElement.dataset.theme=t==='halloween'?'halloween':(t==='cyberpunk'?'cyberpunk':(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'))})()` }} />
      </head>
      <body>
        <ThemeController />
        <PullToRefresh />
        <KeyboardShortcuts />
        <CommandPalette />
        {children}
        <MobileDock />
      </body>
    </html>
  );
}

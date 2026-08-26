import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Skillshot — Show your skills in one shot',
  description: 'Share screenshots of your best work, discover talented makers, and celebrate the details.',
  openGraph: { title: 'Skillshot — Show your skills in one shot', description: 'Share the work you’re proud of.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Skillshot — Show your skills in one shot', description: 'Share the work you’re proud of.', images: ['/og.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

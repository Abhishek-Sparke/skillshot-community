import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
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
      <body>{children}</body>
    </html>
  );
}

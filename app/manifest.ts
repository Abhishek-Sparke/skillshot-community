import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skillshot Community — Visual Showcase',
    short_name: 'Skillshot',
    description: 'Show your skills. In one shot. Showcase virtual photography, 3D art, coding projects, and creative visual builds.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0713',
    theme_color: '#ff7500',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

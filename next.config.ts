import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Désactive l'indicateur de développement Next.js (le "N" en bas de page)
  devIndicators: false,

  // pdfjs-dist référence le package Node natif `canvas` (absent du build Vercel).
  // On indique explicitement à Webpack de l'ignorer côté client.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };

    return config;
  },
};

export default nextConfig;

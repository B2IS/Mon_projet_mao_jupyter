import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// ── Security headers ─────────────────────────────────────────────────────────
const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // XSS Protection (legacy browsers)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Permissions policy — disable unused browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
  // DNS prefetch control
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // HSTS — production only (avoids localhost issues)
  ...(!isDev ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }] : []),
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + Next.js inline + Leaflet CDN
      isDev
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline'",
      // Styles: self + inline (Tailwind, Leaflet)
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      // Images: self + data URIs + Leaflet tiles + ArcGIS
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.arcgisonline.com https://*.arcgis.com https://server.arcgisonline.com",
      // Fonts
      "font-src 'self' data:",
      // API connections: self + external APIs
      [
        "connect-src 'self'",
        'https://api.groq.com',
        'https://*.openai.azure.com',
        'https://api.openai.com',
        'https://*.arcgisonline.com',
        'https://*.arcgis.com',
        'https://server.arcgisonline.com',
        isDev ? 'ws://localhost:3000' : '',
      ].filter(Boolean).join(' '),
      // Frames: block all external
      "frame-src 'none'",
      // Workers: blob for PDF.js
      "worker-src 'self' blob:",
      // Manifests
      "manifest-src 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  devIndicators: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // pdfjs-dist référence le package Node natif `canvas` (absent du build Vercel).
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;

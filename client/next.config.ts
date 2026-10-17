import type { NextConfig } from 'next';

const config: NextConfig = {
  allowedDevOrigins: ['frp-off.com'],
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  async rewrites() {
    const server = (process.env.SERVER_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
    return [{ source: '/api/:path*', destination: `${server}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};

export default config;

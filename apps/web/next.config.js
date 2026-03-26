/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Standalone output uses symlinks; Windows often fails without Developer Mode. Enable only for Docker/CI.
  ...(process.env.NEXT_STANDALONE === '1' ? { output: 'standalone' } : {}),
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*` }];
  },
};

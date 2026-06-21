import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  // Ensure server-external-packages for native modules or those requiring special handling
  serverExternalPackages: ['ssh2'],
};

export default nextConfig;

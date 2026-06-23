import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure server-external-packages for native modules or those requiring special handling
  serverExternalPackages: ['ssh2'],
  // Expose DATABASE_URL to SSR bundles at runtime (required for Prisma adapter)
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  },
};

export default nextConfig;

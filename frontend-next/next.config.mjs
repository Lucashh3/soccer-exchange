import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['use-sync-external-store/shim/with-selector'] = path.resolve(
      process.cwd(),
      'lib/shims/use-sync-external-store-shim-with-selector.js',
    );

    return config;
  },
}

export default nextConfig

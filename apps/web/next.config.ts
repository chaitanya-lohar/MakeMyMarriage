import type { NextConfig } from 'next';
import { apiRewrites, resolveApiInternalUrl } from './src/config/api-proxy';

const apiInternalUrl = resolveApiInternalUrl(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The API client is shipped as TypeScript source from the workspace.
  transpilePackages: ['@makemymarriage/api-client'],
  rewrites() {
    return Promise.resolve(apiRewrites(apiInternalUrl));
  },
};

export default nextConfig;

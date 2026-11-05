import type { NextConfig } from 'next';
import path from 'node:path';

const isDemo = process.env.NEXT_PUBLIC_DEMO === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  // O modo demonstração gera um site 100% estático (GitHub Pages);
  // o modo normal gera um servidor enxuto para o Docker.
  output: isDemo ? 'export' : 'standalone',
  basePath: basePath || undefined,
  trailingSlash: isDemo,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@fluxo/shared'],
  // O lint roda na raiz do monorepo (pnpm lint), não durante o build.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;

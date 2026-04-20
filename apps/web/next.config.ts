import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared"],
  /** Ambientes sem árvore ESLint completa (ex.: peer opcional) ainda geram build de produção. */
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

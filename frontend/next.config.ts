import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { existsSync } from "node:fs";

const dev = process.env.NODE_ENV !== "production";
const cwd = process.cwd();
// Turbo corre `next dev` com cwd = `frontend`; `import.meta.url` no config + Turbopack pode falhar ao resolver a raiz.
const monorepoRoot = path.resolve(cwd, "..", "..");
if (existsSync(path.join(monorepoRoot, ".env"))) {
  loadEnvConfig(monorepoRoot, dev);
}
loadEnvConfig(cwd, dev);

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared"],
  /** Ambientes sem árvore ESLint completa (ex.: peer opcional) ainda geram build de produção. */
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const base = process.env.API_BASE_URL?.trim();
    if (!base) {
      return [];
    }
    const normalized = base.replace(/\/+$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${normalized}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

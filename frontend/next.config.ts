import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { existsSync } from "node:fs";

const dev = process.env.NODE_ENV !== "production";
const cwd = process.cwd();
// Turbo corre `next dev` com cwd = `apps/web`; `import.meta.url` no config + Turbopack pode falhar ao resolver a raiz.
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
};

export default nextConfig;

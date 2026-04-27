import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { existsSync } from "node:fs";

const dev = process.env.NODE_ENV !== "production";
const cwd = process.cwd();
const monorepoRoot = path.resolve(cwd, "..", "..");
if (existsSync(path.join(monorepoRoot, ".env"))) {
  loadEnvConfig(monorepoRoot, dev);
}
loadEnvConfig(cwd, dev);

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

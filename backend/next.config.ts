import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const dev = process.env.NODE_ENV !== "production";
const cwd = process.cwd();
/** Pasta do monorepo: pai de `backend/` quando o Next corre com cwd em `backend/`. */
const monorepoRoot = path.basename(cwd) === "backend" ? path.resolve(cwd, "..") : cwd;
if (existsSync(path.join(monorepoRoot, ".env"))) {
  loadEnvConfig(monorepoRoot, dev);
}
const frontendDir = path.join(monorepoRoot, "frontend");
if (existsSync(path.join(frontendDir, ".env.local")) || existsSync(path.join(frontendDir, ".env"))) {
  loadEnvConfig(frontendDir, dev);
}
loadEnvConfig(cwd, dev);

/** `loadEnvConfig` entre workspaces nem sempre preenche `ADN_WORKER_HMAC_SECRET` no processo do backend. */
function parseDotEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function injectAdnWorkerSecretFromFile(filePath: string) {
  if (!existsSync(filePath)) return;
  try {
    const vars = parseDotEnvFile(readFileSync(filePath, "utf8"));
    const s = vars.ADN_WORKER_HMAC_SECRET?.trim();
    if (s && !process.env.ADN_WORKER_HMAC_SECRET?.trim()) {
      process.env.ADN_WORKER_HMAC_SECRET = s;
    }
  } catch {
    /* ficheiro bloqueado ou inválido */
  }
}

for (const p of [
  path.join(monorepoRoot, ".env"),
  path.join(monorepoRoot, ".env.local"),
  path.join(frontendDir, ".env.local"),
  path.join(frontendDir, ".env"),
  path.join(cwd, ".env.local"),
]) {
  injectAdnWorkerSecretFromFile(p);
}

/** Mesmo padrão que o worker (`merge-monorepo-dotenv`): garante Storage ADN no processo do Next em :3001. */
const ADN_SUPABASE_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
function mergeAdnSupabaseFromFile(filePath: string) {
  if (!existsSync(filePath)) return;
  try {
    const vars = parseDotEnvFile(readFileSync(filePath, "utf8"));
    for (const k of ADN_SUPABASE_KEYS) {
      const v = vars[k]?.trim();
      if (v) {
        process.env[k] = v;
      }
    }
  } catch {
    /* ficheiro bloqueado ou inválido */
  }
}
for (const p of [
  path.join(monorepoRoot, ".env"),
  path.join(monorepoRoot, ".env.local"),
  path.join(frontendDir, ".env"),
  path.join(frontendDir, ".env.local"),
  path.join(cwd, ".env"),
  path.join(cwd, ".env.local"),
]) {
  mergeAdnSupabaseFromFile(p);
}

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

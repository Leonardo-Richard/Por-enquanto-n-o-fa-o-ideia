/**
 * Executa um ciclo real do worker ADN (com download via NFSE_dist).
 * Lê `.env` na raiz do monorepo e invoca `poll_jobs.py --once`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile(join(root, ".env"));
const env = {
  ...process.env,
  ...fileEnv,
  API_INTERNAL_URL:
    process.env.API_INTERNAL_URL ??
    fileEnv.API_INTERNAL_URL ??
    process.env.PORTAL_INTERNAL_URL ??
    fileEnv.PORTAL_INTERNAL_URL,
};

const py = process.env.PYTHON ?? "python";
const script = join(root, "workers", "nfse-portal-bridge", "poll_jobs.py");
const result = spawnSync(py, [script, "--once"], {
  cwd: join(root, "workers", "nfse-portal-bridge"),
  env,
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);

/**
 * Smoke: um ciclo do worker ADN com NFSE_BRIDGE_SKIP_NFSE_DIST=1 (sem download ADN).
 * Lê `.env` na raiz + `frontend/.env.local` e invoca `poll_jobs.py --once`.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMergedMonorepoDotenv, resolvePythonExe } from "./lib/merge-monorepo-dotenv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bridgeDir = join(root, "workers", "nfse-portal-bridge");

const merged = loadMergedMonorepoDotenv(root);
const env = {
  ...merged,
  NFSE_BRIDGE_SKIP_NFSE_DIST: "1",
  API_INTERNAL_URL:
    merged.API_INTERNAL_URL?.trim() ||
    merged.PORTAL_INTERNAL_URL?.trim() ||
    "http://127.0.0.1:3000",
};

const py = resolvePythonExe(bridgeDir);
const script = join(bridgeDir, "poll_jobs.py");
const r = spawnSync(py, [script, "--once"], {
  cwd: bridgeDir,
  env: { ...process.env, ...env },
  stdio: "inherit",
  shell: false,
});
process.exit(r.status ?? 1);

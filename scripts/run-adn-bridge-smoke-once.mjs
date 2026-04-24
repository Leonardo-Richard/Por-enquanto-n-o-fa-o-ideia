/**
 * Smoke: um ciclo do worker ADN com NFSE_BRIDGE_SKIP_NFSE_DIST=1 (sem download ADN).
 * Lê `.env` na raiz do monorepo e invoca `poll_jobs.py --once`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(p) {
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
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

const fileEnv = loadEnvFile(join(root, ".env"));
const env = {
  ...process.env,
  ...fileEnv,
  NFSE_BRIDGE_SKIP_NFSE_DIST: "1",
};

const py = process.env.PYTHON ?? "python";
const script = join(root, "workers", "nfse-portal-bridge", "poll_jobs.py");
const r = spawnSync(py, [script, "--once"], {
  cwd: join(root, "workers", "nfse-portal-bridge"),
  env,
  stdio: "inherit",
  shell: false,
});
process.exit(r.status ?? 1);

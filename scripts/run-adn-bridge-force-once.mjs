/**
 * Executa um ciclo real do worker ADN (com download via NFSE_dist).
 * Lê `.env` na raiz + `frontend/.env.local` e invoca `poll_jobs.py --once`.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLocalPortalBaseUrl } from "./lib/detect-local-portal-base.mjs";
import { loadMergedMonorepoDotenv, resolvePythonExe } from "./lib/merge-monorepo-dotenv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bridgeDir = join(root, "workers", "nfse-portal-bridge");

async function main() {
  const merged = { ...loadMergedMonorepoDotenv(root) };
  let api = merged.API_INTERNAL_URL?.trim() || merged.PORTAL_INTERNAL_URL?.trim();
  if (!api) {
    const d = await detectLocalPortalBaseUrl();
    if (d) {
      merged.API_INTERNAL_URL = d;
      console.error(`[force:adn-bridge] API_INTERNAL_URL autoc: ${d}`);
    }
  }
  const env = {
    ...process.env,
    ...merged,
    API_INTERNAL_URL:
      merged.API_INTERNAL_URL?.trim() ||
      merged.PORTAL_INTERNAL_URL?.trim() ||
      "http://127.0.0.1:3000",
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
  };

  const py = resolvePythonExe(bridgeDir);
  const script = join(bridgeDir, "poll_jobs.py");
  const result = spawnSync(py, [script, "--once"], {
    cwd: bridgeDir,
    env,
    stdio: "inherit",
    shell: false,
  });

  process.exit(result.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

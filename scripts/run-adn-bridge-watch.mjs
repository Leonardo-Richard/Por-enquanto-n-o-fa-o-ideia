/**
 * Mantém o worker ADN (`poll_jobs.py`) em execução — fila `queued` → `running` → `completed`.
 *
 * Variáveis (ficheiros `.env` na raiz + `frontend/.env.local`, depois `process.env`):
 *   DATABASE_URL, ADN_WORKER_HMAC_SECRET
 *   API_INTERNAL_URL ou PORTAL_INTERNAL_URL (default: http://127.0.0.1:3000)
 *
 * Python: defina `PYTHON` ou crie `workers/nfse-portal-bridge/.venv` e instale
 *   `pip install -r workers/nfse-portal-bridge/requirements.txt`
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMergedMonorepoDotenv, resolvePythonExe } from "./lib/merge-monorepo-dotenv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bridgeDir = join(root, "workers", "nfse-portal-bridge");
const pollScript = join(bridgeDir, "poll_jobs.py");

const base = loadMergedMonorepoDotenv(root);
const env = { ...base };

const api = String(env.API_INTERNAL_URL ?? env.PORTAL_INTERNAL_URL ?? "").trim();
if (!api) {
  env.PORTAL_INTERNAL_URL = "http://127.0.0.1:3000";
}

const need = ["DATABASE_URL", "ADN_WORKER_HMAC_SECRET"];
const missing = need.filter((k) => !String(env[k] ?? "").trim());
if (missing.length) {
  console.error(
    `[run-adn-bridge-watch] Faltam variáveis: ${missing.join(", ")}. ` +
      `Defina-as em .env ou frontend/.env.local (raiz do monorepo: ${root}).`,
  );
  process.exit(1);
}

const py = resolvePythonExe(bridgeDir);
const check = spawnSync(py, ["-c", "import psycopg"], {
  cwd: bridgeDir,
  env: { ...process.env, ...env },
  stdio: "pipe",
  shell: false,
});
if (check.status !== 0) {
  console.error(
    `[run-adn-bridge-watch] O módulo Python «psycopg» não está disponível com: ${py}\n` +
      `  cd workers/nfse-portal-bridge\n` +
      `  python -m venv .venv\n` +
      `  .venv\\\\Scripts\\\\activate   (Windows)   ou   source .venv/bin/activate\n` +
      `  pip install -r requirements.txt`,
  );
  process.exit(1);
}

if (!existsSync(pollScript)) {
  console.error(`[run-adn-bridge-watch] Não encontrado: ${pollScript}`);
  process.exit(1);
}

console.log(
  `[run-adn-bridge-watch] A iniciar worker ADN (Ctrl+C para parar). Python=${py} PORTAL/API=${String(env.API_INTERNAL_URL ?? env.PORTAL_INTERNAL_URL ?? "").trim() || env.PORTAL_INTERNAL_URL}`,
);

const child = spawn(py, [pollScript], {
  cwd: bridgeDir,
  env: { ...process.env, ...env },
  stdio: "inherit",
  shell: false,
});

function shutdown(code) {
  try {
    child.kill("SIGINT");
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(code ?? 0), 1500).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
child.on("close", (code) => process.exit(code ?? 1));

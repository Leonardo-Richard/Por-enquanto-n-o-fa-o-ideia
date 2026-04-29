/**
 * Mantém o worker ADN (`poll_jobs.py`) em execução — fila `queued` → `running` → `completed`.
 *
 * Variáveis (`.env` na raiz + `frontend/.env.local` + `process.env`):
 *   DATABASE_URL, ADN_WORKER_HMAC_SECRET
 *   API_INTERNAL_URL ou PORTAL_INTERNAL_URL — se omitidas, tenta-se automaticamente
 *   http://127.0.0.1:3000 e :3001 (onde `/api/health` responder).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLocalPortalBaseUrl } from "./lib/detect-local-portal-base.mjs";
import { loadMergedMonorepoDotenv, resolvePythonExe } from "./lib/merge-monorepo-dotenv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bridgeDir = join(root, "workers", "nfse-portal-bridge");
const pollScript = join(bridgeDir, "poll_jobs.py");

async function main() {
  const base = loadMergedMonorepoDotenv(root);
  const env = { ...base };
  // Shell do utilizador prevalece sobre ficheiros .env (npm pode herdar variáveis definidas antes do comando).
  for (const key of ["API_INTERNAL_URL", "PORTAL_INTERNAL_URL", "DATABASE_URL", "ADN_WORKER_HMAC_SECRET"]) {
    const v = process.env[key]?.trim();
    if (v) {
      env[key] = v;
    }
  }

  let api = String(env.API_INTERNAL_URL ?? env.PORTAL_INTERNAL_URL ?? "").trim();

  async function healthOk(baseUrl) {
    try {
      const u = new URL("/api/health", baseUrl.replace(/\/+$/, ""));
      const r = await fetch(u, { signal: AbortSignal.timeout(1500) });
      return r.ok;
    } catch {
      return false;
    }
  }

  if (api && !(await healthOk(api))) {
    const detected = await detectLocalPortalBaseUrl();
    if (detected) {
      const prev = api.replace(/\/+$/, "");
      if (detected !== prev) {
        console.error(
          `[run-adn-bridge-watch] A URL configurada (${api}) não respondeu a /api/health — a usar: ${detected}`,
        );
      }
      env.API_INTERNAL_URL = detected;
      api = detected;
    }
  }

  if (!api) {
    const detected = await detectLocalPortalBaseUrl();
    if (detected) {
      env.API_INTERNAL_URL = detected;
      api = detected;
      console.error(
        `[run-adn-bridge-watch] API_INTERNAL_URL não definida — a usar automaticamente: ${detected} (primeiro /api/health OK em :3001 ou :3000).`,
      );
    } else {
      env.PORTAL_INTERNAL_URL = "http://127.0.0.1:3000";
      console.error(
        "[run-adn-bridge-watch] Aviso: nenhum Next respondeu em :3001 nem :3000 — a assumir http://127.0.0.1:3000. Defina API_INTERNAL_URL se o portal estiver doutra porta.",
      );
    }
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

  const shown = String(env.API_INTERNAL_URL ?? env.PORTAL_INTERNAL_URL ?? "").trim();
  console.error(
    `[run-adn-bridge-watch] A iniciar worker ADN (Ctrl+C para parar). Python=${py} PORTAL/API=${shown}`,
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

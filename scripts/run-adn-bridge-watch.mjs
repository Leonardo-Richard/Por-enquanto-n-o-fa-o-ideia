/**
 * Mantém o worker ADN (`poll_jobs.py`) em execução — fila `queued` → `running` → `completed`.
 *
 * Variáveis (`.env` na raiz + `frontend/.env.local` + `process.env`):
 *   DATABASE_URL, ADN_WORKER_HMAC_SECRET
 *   API_INTERNAL_URL ou PORTAL_INTERNAL_URL — se omitidas, tenta-se automaticamente
 *   http://127.0.0.1:3000 e :3001 (onde `/api/health` responder).
 *
 * Órfãos `running` (worker morto / PATCH falhou): antes de iniciar o Python, por omissão
 * corre a mesma lógica que `npm run fix:adn-stale-jobs` (limiar ADN_STALE_JOB_HOURS, default 24).
 * Desactivar: ADN_CLEAN_STALE_ON_WORKER_START=0
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseStaleRunningJobs } from "./lib/adn-release-stale-running.mjs";
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

  const cleanStale = String(env.ADN_CLEAN_STALE_ON_WORKER_START ?? "1").trim() !== "0";
  if (cleanStale) {
    const staleHours = Math.max(1, Number(env.ADN_STALE_JOB_HOURS ?? "24"));
    const stale = await releaseStaleRunningJobs(root, staleHours);
    if (stale.ok && stale.count > 0) {
      const ids = stale.released.map((r) => r?.id ?? r).join(", ");
      console.error(
        `[run-adn-bridge-watch] Libertados ${stale.count} job(s) em «running» órfão(s) (started_at há mais de ${stale.hours}h). IDs: ${ids}`,
      );
    } else if (!stale.ok) {
      console.error(`[run-adn-bridge-watch] Aviso: não foi possível limpar jobs órfãos — ${stale.error}`);
    }
  }

  const shown = String(env.API_INTERNAL_URL ?? env.PORTAL_INTERNAL_URL ?? "").trim();
  console.error(
    `[run-adn-bridge-watch] A iniciar worker ADN (Ctrl+C para parar). Python=${py} PORTAL/API=${shown}`,
  );

  const child = spawn(py, [pollScript], {
    cwd: bridgeDir,
    env: {
      ...process.env,
      ...env,
      /** Evita UnicodeEncodeError no print() do bridge no Windows (cp1252). */
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
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

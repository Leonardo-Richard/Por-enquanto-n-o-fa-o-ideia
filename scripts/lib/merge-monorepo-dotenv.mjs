/**
 * Carrega variáveis de `.env` na raiz e `frontend/.env.local` (esta sobrepõe a primeira).
 * Por fim aplica `process.env` para permitir overrides na shell / CI.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function parseDotEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const i = t.indexOf("=");
    if (i < 1) {
      continue;
    }
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/**
 * @param {string} repoRoot - raiz do monorepo (pasta com `frontend/` e `workers/`)
 */
export function loadMergedMonorepoDotenv(repoRoot) {
  const root = parseDotEnvFile(join(repoRoot, ".env"));
  const fe = parseDotEnvFile(join(repoRoot, "frontend", ".env.local"));
  return Object.assign({}, root, fe, process.env);
}

/**
 * Resolve intérprete Python para o bridge (venv local preferido).
 * @param {string} bridgeDir - `workers/nfse-portal-bridge`
 */
export function resolvePythonExe(bridgeDir) {
  if (process.env.PYTHON?.trim()) {
    return process.env.PYTHON.trim();
  }
  const win = process.platform === "win32";
  const venvPy = win
    ? join(bridgeDir, ".venv", "Scripts", "python.exe")
    : join(bridgeDir, ".venv", "bin", "python3");
  if (existsSync(venvPy)) {
    return venvPy;
  }
  return win ? "python" : "python3";
}

/**
 * Lê BETTER_AUTH_* / NEXT_PUBLIC_APP_URL de ../.env e .env.local (sem logar valores)
 * e aplica em Production no projeto Vercel já ligado (frontend/.vercel).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function runVercelEnvAdd(name, value) {
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", name, "production", "--value", value, "--yes", "--force"],
    { cwd: frontendRoot, stdio: "inherit", shell: true },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const rootEnv = parseEnvFile(path.join(frontendRoot, "..", ".env"));
const localEnv = parseEnvFile(path.join(frontendRoot, ".env.local"));

const secret = (
  localEnv.BETTER_AUTH_SECRET ||
  rootEnv.BETTER_AUTH_SECRET ||
  ""
).trim();
const baseUrl = (
  localEnv.BETTER_AUTH_URL ||
  localEnv.NEXT_PUBLIC_APP_URL ||
  rootEnv.BETTER_AUTH_URL ||
  rootEnv.NEXT_PUBLIC_APP_URL ||
  "https://nf-automacao.vercel.app"
).trim();

if (!secret || secret.length < 32) {
  console.error(
    "Defina BETTER_AUTH_SECRET (>=32 caracteres) em .env na raiz ou em frontend/.env.local.",
  );
  process.exit(1);
}

console.info("A definir BETTER_AUTH_SECRET e URLs na Vercel (Production)…");
runVercelEnvAdd("BETTER_AUTH_SECRET", secret);
runVercelEnvAdd("BETTER_AUTH_URL", baseUrl);
runVercelEnvAdd("NEXT_PUBLIC_APP_URL", baseUrl);
console.info("Feito. Faça redeploy do último deployment em produção.");

#!/usr/bin/env node
/**
 * Setup automático do motor ADN cenário B:
 * - pastas .local (perfil Chrome + directório da extensão)
 * - manifest placeholder se ainda não existir extensão real
 * - npm install + playwright install chromium em workers/adn-playwright-motor
 * - pip install -r workers/nfse-portal-bridge/requirements.txt (python-dotenv, etc.)
 *
 * A extensão oficial NFS-e não está no repo; substitua .local/adn-browser-extension pelo pacote descompactado.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const motor = path.join(root, "workers", "adn-playwright-motor");
const bridgeReq = path.join(root, "workers", "nfse-portal-bridge", "requirements.txt");
const localBase = path.join(root, ".local");
const profileDir = path.join(localBase, "adn-chrome-profile");
const extDir = path.join(localBase, "adn-browser-extension");

function run(cmd, opts = {}) {
  const cwd = opts.cwd ?? root;
  console.log(`\n> ${cmd}\n   (cwd: ${cwd})`);
  execSync(cmd, {
    stdio: "inherit",
    cwd,
    shell: true,
    env: { ...process.env, ...opts.env },
  });
}

function quoteWin(p) {
  if (process.platform === "win32" && /[\s]/.test(p)) {
    return `"${p}"`;
  }
  return p;
}

fs.mkdirSync(profileDir, { recursive: true });
fs.mkdirSync(extDir, { recursive: true });

const manifestPath = path.join(extDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  const bg = path.join(extDir, "background.js");
  fs.writeFileSync(
    bg,
    "// Placeholder ADN — substitua toda esta pasta pela extensão NFS-e descompactada (manifest.json real).\n",
    "utf8"
  );
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        manifest_version: 3,
        name: "ADN placeholder (substituir pela extensão real)",
        version: "0.0.1",
        description:
          "Permite validar Playwright/Chrome; para produção, substitua este directório pelo pacote oficial descompactado.",
        background: { service_worker: "background.js" },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(
    "\n[setup-adn-playwright] Criado manifest mínimo em .local/adn-browser-extension — substitua pela extensão real antes de produção.\n"
  );
}

run(`npm install`, { cwd: motor });
run(`npx playwright install chromium`, { cwd: motor });

const reqQ = quoteWin(bridgeReq);
let pipOk = false;
for (const py of ["python", "py -3"]) {
  try {
    run(`${py} -m pip install -r ${reqQ}`);
    pipOk = true;
    break;
  } catch {
    console.warn(`[setup-adn-playwright] Comando falhou: ${py} -m pip …`);
  }
}
if (!pipOk) {
  console.error(
    "\n[setup-adn-playwright] ERRO: não foi possível instalar requirements Python. Instale Python 3.11+ e execute de novo.\n"
  );
  process.exit(1);
}

console.log("\n[setup-adn-playwright] Concluído.\n");

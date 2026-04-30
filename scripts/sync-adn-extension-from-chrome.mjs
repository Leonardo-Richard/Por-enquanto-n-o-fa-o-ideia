#!/usr/bin/env node
/**
 * Copia a extensão «Baixar NFSe…» (ID estável na Chrome Web Store) do perfil Chrome
 * para `.local/adn-browser-extension`, usada pelo motor Playwright (ADN_BROWSER_EXTENSION_DIR).
 *
 * Reexecutar após a extensão ser actualizada no Chrome.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** ID da extensão «Baixar NFSe Nota Fiscal de Serviço Eletrônica…» */
const CHROME_STORE_EXTENSION_ID = "enehmclajcndmgefbmjhecccoegbdgea";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dest = path.join(root, ".local", "adn-browser-extension");

const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) {
  console.error("LOCALAPPDATA não definido (só Windows?).");
  process.exit(1);
}

const extRoot = path.join(
  localAppData,
  "Google",
  "Chrome",
  "User Data",
  "Default",
  "Extensions",
  CHROME_STORE_EXTENSION_ID
);

if (!fs.existsSync(extRoot)) {
  console.error(
    "Pasta da extensão não encontrada:\n",
    extRoot,
    "\nInstale a extensão no Chrome (perfil Default) e volte a tentar."
  );
  process.exit(1);
}

const versions = fs
  .readdirSync(extRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "Temp")
  .map((d) => d.name);

if (!versions.length) {
  console.error("Nenhuma versão encontrada em", extRoot);
  process.exit(1);
}

function versionParts(folderName) {
  const base = folderName.split("_")[0];
  return base.split(".").map((x) => parseInt(x, 10) || 0);
}

function cmpVersion(a, b) {
  const A = versionParts(a);
  const B = versionParts(b);
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

versions.sort(cmpVersion);
const latest = versions[versions.length - 1];
const src = path.join(extRoot, latest);

const manifestPath = path.join(src, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json em falta em", src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
if (process.platform === "win32") {
  // robocopy lida melhor com OneDrive / caminhos longos do que fs.cpSync
  fs.mkdirSync(dest, { recursive: true });
  const r = spawnSync(
    "robocopy",
    [src, dest, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/R:1", "/W:1"],
    { stdio: "inherit", shell: false }
  );
  const st = r.status ?? 8;
  if (st > 7) {
    console.error(`robocopy terminou com código ${st} (>7 = erro).`);
    process.exit(1);
  }
} else {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log(
  `[sync-adn-extension-from-chrome] Copiado ${latest} → .local/adn-browser-extension (${dest})`
);

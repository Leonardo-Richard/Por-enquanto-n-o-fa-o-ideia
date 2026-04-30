#!/usr/bin/env node
/**
 * Motor ADN cenário B — subprocesso invocado pelo worker Python (poll_jobs).
 *
 * Uso: node cli.js --output-dir <dir> --cnpj <14 dígitos> --job-id <uuid>
 *
 * Modos:
 * - **Browser real:** quando `ADN_CHROME_USER_DATA_DIR` e `ADN_BROWSER_EXTENSION_DIR` estão definidos,
 *   ou quando `ADN_PLAYWRIGHT_USE_BROWSER=1`. Abre o Emissor Nacional, carrega a extensão, tenta
 *   «Certificado digital» e aguarda XML novo em `--output-dir`.
 * - **Fatia zero (teste):** se não cumprir as condições acima (ou `ADN_PLAYWRIGHT_FATIA_ZERO=1`), grava XML mínimo.
 *
 * Variáveis: ver README.md
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { outputDir: null, cnpj: null, jobId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir" && argv[i + 1]) {
      out.outputDir = argv[++i];
    } else if (a === "--cnpj" && argv[i + 1]) {
      out.cnpj = argv[++i];
    } else if (a === "--job-id" && argv[i + 1]) {
      out.jobId = argv[++i];
    }
  }
  return out;
}

const debug = process.env.ADN_BROWSER_DEBUG === "1";

function dlog(msg) {
  if (debug) {
    process.stderr.write(`[adn-playwright-motor] ${msg}\n`);
  }
}

function fatiaZeroXml(cnpj14, jobId) {
  const key = `9${cnpj14.slice(0, 2)}${"0".repeat(41)}`.slice(0, 44);
  return `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns="urn:test">
  <dhEmi>2026-01-15T10:00:00-03:00</dhEmi>
  <chave>${key}</chave>
  <nsu>fatia-zero-${jobId.slice(0, 8)}</nsu>
</root>`;
}

function useRealBrowserMode() {
  if ((process.env.ADN_PLAYWRIGHT_FATIA_ZERO || "").trim() === "1") {
    return false;
  }
  if ((process.env.ADN_PLAYWRIGHT_USE_BROWSER || "").trim() === "1") {
    return true;
  }
  const profile = (process.env.ADN_CHROME_USER_DATA_DIR || "").trim();
  const ext = (process.env.ADN_BROWSER_EXTENSION_DIR || "").trim();
  return Boolean(profile && ext);
}

function runFatiaZero(outputDir, cnpjDigits, jobId) {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const outFile = path.join(outputDir, `adn-fatia-zero-${jobId}.xml`);
    fs.writeFileSync(outFile, fatiaZeroXml(cnpjDigits, jobId), "utf8");
    dlog(`artefacto escrito (tamanho ${fs.statSync(outFile).size} bytes)`);
  } catch (e) {
    process.stderr.write(`STDERR_CAT_DISK ${e && e.message ? e.message : "write error"}\n`);
    process.exit(13);
  }
  process.exit(0);
}

async function main() {
  const { outputDir, cnpj, jobId } = parseArgs(process.argv);
  if (!outputDir || !cnpj || !jobId) {
    process.stderr.write("STDERR_CAT_EXTENSION argumentos em falta\n");
    process.exit(12);
  }
  const cnpjDigits = cnpj.replace(/\D/g, "");
  if (cnpjDigits.length !== 14) {
    process.stderr.write("STDERR_CAT_SESSION CNPJ inválido\n");
    process.exit(10);
  }

  if ((process.env.ADN_PLAYWRIGHT_FATIA_ZERO_FAIL || "").trim() === "1") {
    process.stderr.write("STDERR_CAT_EXTENSION falha simulada (ADN_PLAYWRIGHT_FATIA_ZERO_FAIL)\n");
    process.exit(12);
  }

  if (useRealBrowserMode()) {
    const { runBrowserFlow } = await import("./run-browser.mjs");
    await runBrowserFlow({ outputDir, cnpjDigits, jobId });
    return;
  }

  runFatiaZero(outputDir, cnpjDigits, jobId);
}

main().catch((e) => {
  process.stderr.write(`STDERR_CAT_UNKNOWN ${e && e.message ? e.message : String(e)}\n`);
  process.exit(1);
});

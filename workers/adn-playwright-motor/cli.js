#!/usr/bin/env node
/**
 * Motor ADN cenário B — subprocesso invocado pelo worker Python (poll_jobs).
 * Não escrever caminhos de perfil Chrome ou extensão em stdout/stderr em produção.
 *
 * Uso: node cli.js --output-dir <dir> --cnpj <14 dígitos> --job-id <uuid>
 *
 * Variáveis: ADN_BROWSER_DEBUG=1 (logs extra para stderr, ainda redigidos)
 *            ADN_PLAYWRIGHT_FATIA_ZERO_FAIL=1 — força falha mapeável (testes)
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

/**
 * XML mínimo para fatia zero (artefacto de teste). Chave 44 dígitos fictícia
 * alinhada ao padrão synthetic do bridge quando o parser extrair.
 */
function fatiaZeroXml(cnpj14, jobId) {
  const key = `9${cnpj14.slice(0, 2)}${"0".repeat(41)}`.slice(0, 44);
  return `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns="urn:test">
  <dhEmi>2026-01-15T10:00:00-03:00</dhEmi>
  <chave>${key}</chave>
  <nsu>fatia-zero-${jobId.slice(0, 8)}</nsu>
</root>`;
}

const main = () => {
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

  if (process.env.ADN_PLAYWRIGHT_FATIA_ZERO_FAIL === "1") {
    process.stderr.write("STDERR_CAT_EXTENSION falha simulada (ADN_PLAYWRIGHT_FATIA_ZERO_FAIL)\n");
    process.exit(12);
  }

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
};

main();

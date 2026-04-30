/**
 * Fluxo real: Chromium + extensão + URL do Emissor Nacional.
 * Limitação: o diálogo nativo de escolha de certificado (Windows) não é controlável pelo Playwright;
 * use ADN_CHROME_USER_DATA_DIR com perfil onde já autenticou ou com política de certificado, ou operação assistida.
 */

import fs from "node:fs";
import path from "node:path";

const DEFAULT_LOGIN_URL =
  "https://www.nfse.gov.br/EmissorNacional/Login?ReturnUrl=%2fEmissorNacional";

function dlog(msg) {
  if (process.env.ADN_BROWSER_DEBUG === "1") {
    process.stderr.write(`[adn-playwright-motor] ${msg}\n`);
  }
}

/**
 * @param {{ outputDir: string; cnpjDigits: string; jobId: string }} opts
 */
export async function runBrowserFlow(opts) {
  const { chromium } = await import("playwright");

  const loginUrl = (process.env.ADN_NFSE_LOGIN_URL || "").trim() || DEFAULT_LOGIN_URL;
  const userDataDir = (process.env.ADN_CHROME_USER_DATA_DIR || "").trim();
  const extDir = (process.env.ADN_BROWSER_EXTENSION_DIR || "").trim();

  if (!userDataDir) {
    process.stderr.write(
      "STDERR_CAT_SESSION Defina ADN_CHROME_USER_DATA_DIR (perfil Chrome persistente; ver README).\n",
    );
    process.exit(10);
  }
  if (!extDir || !fs.existsSync(extDir)) {
    process.stderr.write(
      "STDERR_CAT_EXTENSION Defina ADN_BROWSER_EXTENSION_DIR com caminho valido da extensao descompactada.\n",
    );
    process.exit(12);
  }

  const headless = process.env.ADN_BROWSER_HEADLESS === "1";
  const channel = (process.env.ADN_PLAYWRIGHT_CHANNEL || "").trim() || undefined;
  const waitArtifactsSec = Math.max(
    30,
    Number.parseInt(process.env.ADN_BROWSER_WAIT_ARTIFACTS_SEC || "300", 10) || 300,
  );

  const launchArgs = [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];

  /** Perfil isolado por job se ADN_CHROME_USER_DATA_DIR não for absoluto (não recomendado em prod). */
  const profileDir = path.isAbsolute(userDataDir)
    ? userDataDir
    : path.resolve(process.cwd(), userDataDir);

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(opts.outputDir, { recursive: true });

  dlog(`jobId=${opts.jobId} cnpj=${opts.cnpjDigits}`);
  dlog(`loginUrl=${loginUrl}`);
  dlog(`profileDir=(definido)`);
  dlog(`extensionDir=(definido)`);
  dlog(`headless=${headless} channel=${channel || "bundled-chromium"}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: channel || undefined,
    headless,
    args: launchArgs,
    viewport: { width: 1360, height: 900 },
    locale: "pt-BR",
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  const artifactSince = Date.now() - 10_000;

  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  } catch (e) {
    await context.close().catch(() => {});
    process.stderr.write(`STDERR_CAT_PORTAL falha ao carregar pagina de login: ${e?.message || e}\n`);
    process.exit(11);
  }

  try {
    const certClicked = await clickCertificadoDigitalIfPresent(page);
    dlog(`certificadoDigitalClicked=${certClicked}`);
  } catch (e) {
    dlog(`certificado click ignorado: ${e?.message || e}`);
  }

  /** Aguarda a extensão gravar XML na pasta de saída (só ficheiros novos nesta execução). */
  const deadline = Date.now() + waitArtifactsSec * 1000;
  let found = false;
  while (Date.now() < deadline) {
    const xmls = listNewXmlFiles(opts.outputDir, artifactSince);
    if (xmls.length > 0) {
      dlog(`artefactos XML novos: ${xmls.length}`);
      found = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  await context.close().catch(() => {});

  if (!found) {
    process.stderr.write(
      "STDERR_CAT_EXTENSION Nenhum XML novo na pasta de saida dentro do tempo. Verifique extensao, sessao no perfil e ADN_BROWSER_WAIT_ARTIFACTS_SEC.\n",
    );
    process.exit(12);
  }

  process.exit(0);
}

function listNewXmlFiles(dir, sinceMs) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.toLowerCase().endsWith(".xml")) {
      continue;
    }
    const full = path.join(dir, name);
    try {
      if (fs.statSync(full).mtimeMs >= sinceMs) {
        out.push(full);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * Clica na entrada de acesso por certificado digital (portal contribuinte NFS-e).
 * Depois disto o SO pode mostrar o selector de certificado — fora do controlo do Playwright.
 */
async function clickCertificadoDigitalIfPresent(page) {
  const timeout = 15_000;
  const locators = [
    page.getByRole("link", { name: /certificado\s+digital/i }),
    page.getByRole("button", { name: /certificado\s+digital/i }),
    page.locator("a").filter({ hasText: /certificado\s+digital/i }),
    page.locator('[href*="certificado" i]').first(),
  ];

  for (const loc of locators) {
    try {
      const first = loc.first();
      await first.waitFor({ state: "visible", timeout: 5000 });
      await first.click({ timeout });
      await new Promise((r) => setTimeout(r, 2000));
      return true;
    } catch {
      // tentar seguinte
    }
  }
  return false;
}

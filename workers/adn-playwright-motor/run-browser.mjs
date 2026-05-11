/**
 * Fluxo real: Chromium + extensão «Baixar NFSe» + Emissor Nacional.
 *
 * Etapas:
 *   1. Configura `Preferences` do perfil para que os downloads do Chrome caiam em --output-dir
 *      (a extensão usa `chrome.downloads.download` com caminhos relativos).
 *   2. Lança o Chrome com a extensão pré-carregada (--load-extension) e perfil persistente.
 *   3. Navega para o portal; o auto-select do Windows escolhe o certificado automaticamente
 *      (configurado por `cert_materialization.py` no worker Python).
 *   4. Quando a sessão fica activa, navega para `Notas/Emitidas` (ou `Recebidas`).
 *   5. Abre o popup da extensão como aba (chrome-extension://<ID>/popup.html), preenche datas,
 *      escolhe XML e clica em «Iniciar Download».
 *   6. Aguarda os XML caírem em --output-dir (verificação recursiva).
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_LOGIN_URL =
  "https://www.nfse.gov.br/EmissorNacional/Login?ReturnUrl=%2fEmissorNacional";

/**
 * ID *esperado* da extensão «Baixar NFSe» (a extensão tem campo `key` no manifest, logo o
 * mesmo ID é gerado quando carregada como unpacked via --load-extension).
 * Em runtime confirmamos com `detectLoadedExtensionId` (mais robusto contra alterações).
 */
const ADN_EXT_ID_FALLBACK = "enehmclajcndmgefbmjhecccoegbdgea";

function dlog(msg) {
  if (process.env.ADN_BROWSER_DEBUG === "1") {
    process.stderr.write(`[adn-playwright-motor] ${msg}\n`);
  }
}

function fmtIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parseia `YYYY-MM-DD` para um `Date` local à meia-noite. Evita armadilhas de
 * timezone do construtor `new Date("YYYY-MM-DD")` (UTC) misturado com o
 * formatter local.
 */
function parseLocalIsoDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Calcula `to − 1 ano + 7 dias` — `from` mais antigo seguro para a extensão
 * «Baixar NFSe» ("Período máximo permitido: 12 meses").
 *
 * Empíricamente a extensão recusa mesmo janelas de 364 dias (e.g., 12/5/2025
 * → 11/5/2026), provavelmente usando contagem em meses calendário ou 365 dias
 * estritos com comparação `>` (não `>=`). Adicionar 7 dias dá margem confortável
 * (~358 dias = ~11 meses e 24 dias) para qualquer interpretação razoável.
 *
 * Cliente que quiser maximizar a janela pode opt-in com `ADN_BROWSER_FETCH_FROM`
 * explícito; o retry automático em `driveExtensionPopupWithRetry` cobre o caso
 * em que essa janela explícita ainda é recusada.
 */
function dateMinus12MonthsSafe(to) {
  const d = new Date(to.getTime());
  d.setFullYear(d.getFullYear() - 1);
  d.setDate(d.getDate() + 7);
  return d;
}

/**
 * Resolve a janela de busca usada pela extensão. Ordem de preferência para `from`:
 *   1. `ADN_BROWSER_FETCH_FROM=YYYY-MM-DD` (data explícita).
 *   2. `ADN_BROWSER_FETCH_FROM=year-start` → 1 Jan do ano corrente (caso comum:
 *      «desde o início do ano até hoje»).
 *   3. `ADN_BROWSER_FETCH_DAYS=N` → today − N dias (clamp para 12 meses).
 *   4. **Default**: today − 12 meses + 1 dia (janela máxima segura).
 *
 * `to` é `ADN_BROWSER_FETCH_TO=YYYY-MM-DD` ou hoje.
 *
 * Limite forçado: a extensão recusa janelas > 12 meses com a mensagem
 * "Período máximo permitido: 12 meses". Quando `FETCH_FROM` ou `FETCH_DAYS`
 * resultarem numa janela maior, fazemos clamp silenciosamente para a janela
 * máxima segura, avisando via stderr.
 */
function resolveDateWindow() {
  const envFrom = (process.env.ADN_BROWSER_FETCH_FROM || "").trim();
  const envTo = (process.env.ADN_BROWSER_FETCH_TO || "").trim();
  const today = new Date();
  const toDate =
    envTo && /^\d{4}-\d{2}-\d{2}$/.test(envTo) ? parseLocalIsoDate(envTo) : today;
  const minSafeFrom = dateMinus12MonthsSafe(toDate);

  let fromDate;
  if (envFrom.toLowerCase() === "year-start") {
    fromDate = new Date(today.getFullYear(), 0, 1);
  } else if (envFrom && /^\d{4}-\d{2}-\d{2}$/.test(envFrom)) {
    fromDate = parseLocalIsoDate(envFrom);
  } else if (process.env.ADN_BROWSER_FETCH_DAYS) {
    const days = Math.max(
      1,
      Math.min(
        730,
        Number.parseInt(process.env.ADN_BROWSER_FETCH_DAYS, 10) || 365,
      ),
    );
    fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  } else {
    fromDate = minSafeFrom;
  }

  if (fromDate.getTime() < minSafeFrom.getTime()) {
    process.stderr.write(
      `[adn-playwright-motor] AVISO: janela pedida (${fmtIsoDate(fromDate)}) excede ` +
        `o limite de 12 meses da extensão. A ajustar para ${fmtIsoDate(minSafeFrom)}. ` +
        `Para histórico maior, dispare jobs com janelas separadas (e.g., ano a ano).\n`,
    );
    fromDate = minSafeFrom;
  }

  return { from: fmtIsoDate(fromDate), to: fmtIsoDate(toDate) };
}

function resolveTipoNota() {
  const t = (process.env.ADN_BROWSER_TIPO_NOTA || "Emitidas").trim().toLowerCase();
  return t.startsWith("receb") ? "Recebidas" : "Emitidas";
}

/**
 * Ajusta `<profileDir>/Default/Preferences` para que o Chrome guarde downloads em outputDir
 * sem prompt. A extensão (`chrome.downloads.download`) usa esta pasta como raiz.
 *
 * Estratégia robusta:
 *   - Se o ficheiro existir: actualiza apenas as chaves relevantes (preserva o resto).
 *   - Se não existir: cria estrutura mínima; o Chrome completa no primeiro arranque.
 */
function configureChromeDownloadPreferences(profileDir, outputDir) {
  const defaultDir = path.join(profileDir, "Default");
  const prefsPath = path.join(defaultDir, "Preferences");
  fs.mkdirSync(defaultDir, { recursive: true });

  let prefs = {};
  if (fs.existsSync(prefsPath)) {
    try {
      prefs = JSON.parse(fs.readFileSync(prefsPath, "utf8"));
    } catch {
      prefs = {};
    }
  }
  prefs.download = prefs.download || {};
  prefs.download.default_directory = outputDir;
  prefs.download.directory_upgrade = true;
  prefs.download.prompt_for_download = false;
  prefs.download.extensions_to_open = "";
  prefs.profile = prefs.profile || {};
  prefs.profile.default_content_setting_values =
    prefs.profile.default_content_setting_values || {};
  prefs.profile.default_content_setting_values.automatic_downloads = 1;
  prefs.safebrowsing = prefs.safebrowsing || {};
  prefs.safebrowsing.enabled = false;

  try {
    fs.writeFileSync(prefsPath, JSON.stringify(prefs));
    dlog(`Preferences actualizadas (download.default_directory=${outputDir})`);
  } catch (e) {
    process.stderr.write(
      `STDERR_CAT_DISK falha ao escrever Preferences do Chrome: ${e?.message || e}\n`,
    );
    throw e;
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
  const useForceInstall = (process.env.ADN_BROWSER_USE_FORCE_INSTALL || "1").trim() !== "0";

  if (!userDataDir) {
    process.stderr.write(
      "STDERR_CAT_SESSION Defina ADN_CHROME_USER_DATA_DIR (perfil Chrome persistente; ver README).\n",
    );
    process.exit(10);
  }
  /**
   * Em Chrome 137+, --load-extension foi removido em builds branded; o caminho oficial
   * agora é Group Policy (ExtensionInstallForcelist), aplicada por
   * `cert_materialization._set_chrome_extension_force_install_policy`. Quando essa
   * policy está activa (default), a pasta unpacked é opcional.
   */
  if (!useForceInstall && (!extDir || !fs.existsSync(extDir))) {
    process.stderr.write(
      "STDERR_CAT_EXTENSION Defina ADN_BROWSER_EXTENSION_DIR (extensão unpacked) ou deixe ADN_BROWSER_USE_FORCE_INSTALL=1 (default) para usar a policy do Chrome.\n",
    );
    process.exit(12);
  }

  const headless = process.env.ADN_BROWSER_HEADLESS === "1";
  const channel = (process.env.ADN_PLAYWRIGHT_CHANNEL || "").trim() || undefined;
  /**
   * Default 900s (15 min). Janelas grandes (`year-start`, ~366 dias) requerem
   * paginação interna na extensão e podem ser mais lentas que a janela de 31
   * dias original. O `idle settle` interrompe cedo se já houver ZIPs estáveis.
   */
  const waitArtifactsSec = Math.max(
    30,
    Number.parseInt(process.env.ADN_BROWSER_WAIT_ARTIFACTS_SEC || "900", 10) || 900,
  );
  const idleSettleSec = Math.max(
    8,
    Number.parseInt(process.env.ADN_BROWSER_IDLE_SETTLE_SEC || "20", 10) || 20,
  );

  const profileDir = path.isAbsolute(userDataDir)
    ? userDataDir
    : path.resolve(process.cwd(), userDataDir);

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(opts.outputDir, { recursive: true });

  configureChromeDownloadPreferences(profileDir, opts.outputDir);

  const launchArgs = ["--no-first-run", "--no-default-browser-check"];
  /**
   * Em Chromium for Testing (bundled do Playwright; channel vazio) o `--load-extension`
   * funciona normalmente. Em Chrome estável (channel='chrome') Google removeu a flag
   * em 137+, e o caminho recomendado é `ExtensionInstallForcelist` via Group Policy
   * (configurada pelo worker Python). Aqui passamos a flag sempre que houver pasta —
   * o Chrome estável ignora-a, o Chromium aceita-a.
   */
  if (extDir && fs.existsSync(extDir)) {
    launchArgs.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  }
  if (channel === "chrome" && extDir && !useForceInstall) {
    process.stderr.write(
      "[adn-playwright-motor] AVISO: ADN_PLAYWRIGHT_CHANNEL=chrome com unpacked extension. " +
        "Chrome estável 137+ não carrega extensões via --load-extension. " +
        "Recomenda-se omitir ADN_PLAYWRIGHT_CHANNEL (default: Chromium for Testing) " +
        "ou manter ADN_BROWSER_USE_FORCE_INSTALL=1 (force-install via policy).\n",
    );
  }

  const tipoNota = resolveTipoNota();
  const { from: dateFrom, to: dateTo } = resolveDateWindow();
  const windowDays = Math.round(
    (new Date(`${dateTo}T00:00:00Z`).getTime() -
      new Date(`${dateFrom}T00:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  /**
   * Janela é sempre logada (sem ADN_BROWSER_DEBUG): imprescindível para o utilizador
   * perceber «porque é que a extensão não baixou nada» (default cobre 366 dias).
   */
  process.stderr.write(
    `[adn-playwright-motor] janela busca tipoNota=${tipoNota} ` +
      `dateFrom=${dateFrom} dateTo=${dateTo} dias=${windowDays}\n`,
  );

  dlog(`jobId=${opts.jobId} cnpj=${opts.cnpjDigits}`);
  dlog(`loginUrl=${loginUrl}`);
  dlog(`profileDir=(definido)`);
  dlog(`extensionDir=(definido)`);
  dlog(`headless=${headless} channel=${channel || "bundled-chromium"}`);
  dlog(`waitArtifactsSec=${waitArtifactsSec}`);

  /**
   * Por defeito o Playwright passa várias flags que sabotam o force-install de
   * extensões via policy:
   *   - `--disable-component-update` desliga o Component Update Service (o serviço
   *     que vai à Web Store buscar a extensão).
   *   - `--disable-background-networking` desliga TODO o tráfego de fundo, incluindo
   *     a comunicação com `clients2.google.com/service/update2/crx`.
   *   - `--disable-default-apps` e `--disable-component-extensions-with-background-pages`
   *     podem interferir com a inicialização do registo de extensões.
   *
   * Removemos esse conjunto via `ignoreDefaultArgs`. As outras flags do Playwright
   * (--no-first-run, --enable-automation, etc.) ficam.
   */
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: channel || undefined,
    headless,
    args: launchArgs,
    ignoreDefaultArgs: [
      "--disable-component-update",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-component-extensions-with-background-pages",
    ],
    viewport: { width: 1360, height: 900 },
    locale: "pt-BR",
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  });

  const portalPage = await context.newPage();
  const artifactSince = Date.now() - 10_000;

  try {
    await portalPage.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  } catch (e) {
    await context.close().catch(() => {});
    process.stderr.write(`STDERR_CAT_PORTAL falha ao carregar pagina de login: ${e?.message || e}\n`);
    process.exit(11);
  }

  try {
    const certClicked = await clickCertificadoDigitalIfPresent(portalPage);
    dlog(`certificadoDigitalClicked=${certClicked}`);
  } catch (e) {
    dlog(`certificado click ignorado: ${e?.message || e}`);
  }

  try {
    await waitForAuthenticatedPortal(portalPage, 90_000);
  } catch (e) {
    await context.close().catch(() => {});
    process.stderr.write(
      `STDERR_CAT_SESSION sessao do portal nao autenticada (cert digital): ${e?.message || e}\n`,
    );
    process.exit(10);
  }

  /** Navega a aba para a listagem (Emitidas/Recebidas) que a extensão usa como activeTab. */
  const listingUrl = `https://www.nfse.gov.br/EmissorNacional/Notas/${tipoNota}`;
  try {
    await portalPage.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    /** Espera estabilizar (a extensão precisa que o portal já tenha sessão + token). */
    await portalPage
      .waitForLoadState("networkidle", { timeout: 30_000 })
      .catch(() => {});
  } catch (e) {
    await context.close().catch(() => {});
    process.stderr.write(`STDERR_CAT_PORTAL falha ao abrir ${listingUrl}: ${e?.message || e}\n`);
    process.exit(11);
  }

  /**
   * Detecta o ID real da extensão carregada. Quando usamos `ExtensionInstallForcelist`,
   * o Chrome precisa baixar a extensão da Web Store na primeira execução do perfil —
   * pode demorar até ~60s consoante a ligação de rede.
   */
  let extId = ADN_EXT_ID_FALLBACK;
  /**
   * Default 180 s para acomodar o primeiro download da Web Store em redes lentas.
   * Sobreponha com `ADN_BROWSER_EXTENSION_WAIT_MS` se for preciso menos/mais.
   */
  const extDetectTimeoutMs = Math.max(
    25_000,
    Number.parseInt(process.env.ADN_BROWSER_EXTENSION_WAIT_MS || "180000", 10) || 180_000,
  );
  try {
    /**
     * Procura especificamente o ID da extensão «Baixar NFSe». O Chrome carrega várias
     * component-extensions internas (com IDs diferentes) que apareceriam em
     * `serviceWorkers()`/`backgroundPages()` antes da nossa, fazendo o motor abrir o
     * popup errado.
     */
    const detected = await waitForExtensionId(context, ADN_EXT_ID_FALLBACK, extDetectTimeoutMs);
    if (detected) {
      extId = detected;
      dlog(`extensão alvo detectada: id=${extId}`);
    } else {
      const others = listKnownExtensionIds(context);
      dlog(
        `extensão alvo (${ADN_EXT_ID_FALLBACK}) não apareceu em ${extDetectTimeoutMs}ms ` +
          `(IDs vistos: ${others.join(", ") || "nenhum"}). Vai tentar mesmo assim.`,
      );
    }
  } catch (e) {
    dlog(`waitForExtensionId erro ignorado: ${e?.message || e}`);
  }

  /** Abre o popup da extensão como aba normal. */
  const popupUrl = `chrome-extension://${extId}/popup.html`;
  let popupPage;
  try {
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  } catch (e) {
    /** Captura screenshots de diagnóstico antes de fechar o contexto. */
    const diagInfo = await captureDiagnostics(context, opts.outputDir).catch(
      (de) => `(diag falhou: ${de?.message || de})`,
    );
    await context.close().catch(() => {});
    const hint = manifestHintFromExtDir(extDir);
    process.stderr.write(
      `STDERR_CAT_EXTENSION falha ao abrir popup da extensao (${popupUrl}): ${e?.message || e}\n` +
        `${hint}\n` +
        `${diagInfo}\n`,
    );
    process.exit(12);
  }

  /**
   * A aba do portal precisa ficar `active` no Chrome durante o download — o background da
   * extensão chama `chrome.tabs.query({ active: true })` para identificar a página da listagem
   * e injectar scripts via `chrome.scripting.executeScript`.
   */
  await portalPage.bringToFront();

  let effectiveDateFrom = dateFrom;
  let periodAcceptedAfterRetry = false;
  try {
    const piloted = await driveExtensionPopupWithRetry(popupPage, {
      tipoNota,
      dateFrom,
      dateTo,
    });
    effectiveDateFrom = piloted.dateFrom;
    if (piloted.dateFrom !== dateFrom) {
      process.stderr.write(
        `[adn-playwright-motor] janela efectiva (após retry): ` +
          `dateFrom=${piloted.dateFrom} dateTo=${piloted.dateTo} (tentativas=${piloted.attempts}).\n`,
      );
    }
    /**
     * Se o retry levou a uma janela aceite, marcamos a flag — assim a detecção
     * de `period_over_12_months` no loop principal não dispara falso positivo
     * caso o popup mantenha texto residual da tentativa anterior.
     */
    periodAcceptedAfterRetry = !piloted.blocked;
  } catch (e) {
    await context.close().catch(() => {});
    process.stderr.write(
      `STDERR_CAT_EXTENSION falha ao pilotar popup da extensao: ${e?.message || e}\n`,
    );
    process.exit(12);
  }

  /**
   * Aguarda XML novos no outputDir (recursivo) com janela de estabilização.
   *
   * A extensão «Baixar NFSe» entrega os XML dentro de **um ZIP** por padrão. O
   * loop também:
   *   - Detecta ZIPs novos no `outputDir` (e em `~/Downloads` como fallback) e
   *     descomprime-os para subpastas, gerando os XML que `listNewXmlFiles…`
   *     procura.
   *   - Marca ZIPs já processados com sufixo `.processed` para idempotência.
   */
  const deadline = Date.now() + waitArtifactsSec * 1000;
  let lastCount = 0;
  let lastChange = Date.now();
  let found = 0;
  let totalZipsIngested = 0;
  let totalZipsFromDownloads = 0;
  let lastStatusLog = 0;
  let lastStatusText = "";
  const statusLogInterval = 15_000;

  while (Date.now() < deadline) {
    const movedFromDl = ingestZipsFromUserDownloads(opts.outputDir, artifactSince);
    if (movedFromDl > 0) {
      totalZipsFromDownloads += movedFromDl;
      lastChange = Date.now();
    }
    const ingested = ingestZipDownloads(opts.outputDir, artifactSince);
    if (ingested > 0) {
      totalZipsIngested += ingested;
      lastChange = Date.now();
    }

    const xmls = listNewXmlFilesRecursive(opts.outputDir, artifactSince);
    if (xmls.length !== lastCount) {
      lastCount = xmls.length;
      lastChange = Date.now();
      process.stderr.write(
        `[adn-playwright-motor] artefactos XML novos (parcial): ${xmls.length} ` +
          `(zips_extraidos=${totalZipsIngested} zips_de_downloads=${totalZipsFromDownloads})\n`,
      );
    }
    found = xmls.length;

    /** Periodicamente, loga o estado do popup (#status + botão disabled). */
    const now = Date.now();
    if (now - lastStatusLog >= statusLogInterval) {
      lastStatusLog = now;
      const st = await readPopupStatus(popupPage);
      const elapsedSec = Math.round((now - artifactSince) / 1000);
      if (st.statusText !== lastStatusText) {
        lastStatusText = st.statusText;
        process.stderr.write(
          `[adn-playwright-motor] popup status @${elapsedSec}s: ` +
            `disabled=${st.buttonDisabled} text=${JSON.stringify(st.statusText)} ` +
            `xmls=${found} zips=${totalZipsIngested}+${totalZipsFromDownloads}\n`,
        );
      } else {
        process.stderr.write(
          `[adn-playwright-motor] heartbeat @${elapsedSec}s: ` +
            `xmls=${found} zips_extraidos=${totalZipsIngested} ` +
            `zips_downloads=${totalZipsFromDownloads}\n`,
        );
      }
    }

    /** Se já há ficheiros e nada novo durante `idleSettleSec`, considera concluído. */
    if (found > 0 && Date.now() - lastChange >= idleSettleSec * 1000) {
      break;
    }
    /** Atalho: se popup mostra mensagem clara de «sem notas», sai sem erro. */
    try {
      const semNotas = await popupSaysSemNotas(popupPage);
      if (semNotas) {
        process.stderr.write(
          "[adn-playwright-motor] popup sinalizou ausência de notas no período; saindo sem erro.\n",
        );
        await context.close().catch(() => {});
        process.exit(0);
      }
    } catch {
      /* ignore */
    }

    /** Atalho: erro bloqueante (período > 12 meses, sessão expirada). */
    try {
      const blockingErr = await popupBlockingError(popupPage);
      /**
       * Quando o `driveExtensionPopupWithRetry` já aceitou uma janela menor,
       * ignoramos `period_over_12_months` residual (a extensão pode manter o
       * texto antigo no DOM mesmo depois de aceitar a nova janela). Outros
       * erros bloqueantes (sessão expirada, etc.) continuam a parar o motor.
       */
      const shouldIgnore =
        blockingErr === "period_over_12_months" && periodAcceptedAfterRetry;
      if (blockingErr && !shouldIgnore) {
        process.stderr.write(
          `[adn-playwright-motor] popup bloqueado: ${blockingErr}; a capturar diagnostics.\n`,
        );
        const popupDiagInfo = await capturePopupDiagnostics(
          popupPage,
          opts.outputDir,
        ).catch(() => "(popup diag falhou)");
        await context.close().catch(() => {});
        const stderrCat = blockingErr === "session_expired"
          ? "STDERR_CAT_SESSION"
          : "STDERR_CAT_EXTENSION";
        process.stderr.write(
          `${stderrCat} extensão recusou o pedido (${blockingErr}). ` +
            `${popupDiagInfo}\n`,
        );
        process.exit(blockingErr === "session_expired" ? 10 : 12);
      }
    } catch {
      /* ignore */
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  // Última passagem para apanhar ZIPs que cheguem no fim do timer.
  totalZipsFromDownloads += ingestZipsFromUserDownloads(opts.outputDir, artifactSince);
  totalZipsIngested += ingestZipDownloads(opts.outputDir, artifactSince);
  found = listNewXmlFilesRecursive(opts.outputDir, artifactSince).length;

  if (found === 0) {
    /**
     * Capturamos screenshot + HTML do popup ANTES de fechar o contexto para
     * podermos ver visualmente o que a extensão estava a mostrar (mensagem de
     * erro, bloqueio de janela, etc.). Salvo em `outputDir/_diag/`.
     */
    const finalStatus = await readPopupStatus(popupPage).catch(() => ({
      buttonDisabled: null,
      statusText: "",
    }));
    const popupDiagInfo = await capturePopupDiagnostics(popupPage, opts.outputDir).catch(
      (e) => `(popup diag falhou: ${e?.message || e})`,
    );

    await context.close().catch(() => {});

    /**
     * Snapshot de diagnóstico: listamos qualquer ficheiro recente em outputDir
     * + Downloads para o `stderr_tail` (consumido pelo worker), facilitando
     * descobrir se o ZIP caiu fora da pasta esperada ou ficou em `.crdownload`.
     */
    const recentOut = snapshotRecentFiles(opts.outputDir, artifactSince);
    const dlPath = userDownloadsDir();
    const recentDl = dlPath ? snapshotRecentFiles(dlPath, artifactSince) : [];
    process.stderr.write(
      "STDERR_CAT_EXTENSION Nenhum XML novo na pasta de saida dentro do tempo. " +
        "Verifique extensao, sessao e ADN_BROWSER_WAIT_ARTIFACTS_SEC.\n" +
        `[diag] outputDir=${opts.outputDir} ficheiros_recentes=${recentOut.length} ` +
        `zips_extraidos=${totalZipsIngested} zips_de_downloads=${totalZipsFromDownloads}\n` +
        `[diag] popup status final: disabled=${finalStatus.buttonDisabled} ` +
        `text=${JSON.stringify(finalStatus.statusText)}\n` +
        `[diag] popup ${popupDiagInfo}\n`,
    );
    for (const f of recentOut.slice(0, 10)) {
      process.stderr.write(`[diag] outputDir > ${f.path} (${f.size}B)\n`);
    }
    if (dlPath) {
      process.stderr.write(
        `[diag] downloadsDir=${dlPath} ficheiros_recentes=${recentDl.length}\n`,
      );
      for (const f of recentDl.slice(0, 10)) {
        process.stderr.write(`[diag] downloads > ${f.path} (${f.size}B)\n`);
      }
    }
    process.exit(12);
  }

  await context.close().catch(() => {});

  dlog(
    `concluído: ${found} XML novos detectados ` +
      `(zips_extraidos=${totalZipsIngested} zips_de_downloads=${totalZipsFromDownloads}).`,
  );
  process.exit(0);
}

/**
 * Lê recursivamente .xml em outputDir, filtrando pela mtime (apenas novos nesta execução).
 */
function listNewXmlFilesRecursive(dir, sinceMs) {
  return listFilesByExt(dir, sinceMs, [".xml"]);
}

function listFilesByExt(dir, sinceMs, extensions) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  const exts = extensions.map((e) => e.toLowerCase());
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      const lower = ent.name.toLowerCase();
      if (!exts.some((e) => lower.endsWith(e))) continue;
      try {
        if (fs.statSync(full).mtimeMs >= sinceMs) {
          out.push(full);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

/**
 * Snapshot diagnóstico: lista TODOS os ficheiros recentes (mtime >= sinceMs) em
 * `dir` (recursivo) — útil para saber porque é que `found = 0` (extensão baixou
 * ZIP, ficheiro `.crdownload` em curso, etc.).
 *
 * Limitado a 30 entradas para não inundar stderr.
 */
function snapshotRecentFiles(dir, sinceMs, limit = 30) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0 && out.length < limit) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (out.length >= limit) break;
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      try {
        const st = fs.statSync(full);
        if (st.mtimeMs >= sinceMs) {
          out.push({ path: full, size: st.size, mtimeMs: st.mtimeMs });
        }
      } catch {
        /* ignore */
      }
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

/**
 * Caminho da pasta «Downloads» do utilizador actual. A extensão pode ignorar o
 * `download.default_directory` quando passa um filename absoluto, e cair aqui.
 */
function userDownloadsDir() {
  const candidates = [
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Downloads") : null,
    process.env.HOME ? path.join(process.env.HOME, "Downloads") : null,
    path.join(os.homedir(), "Downloads"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Descomprime `zipPath` para `targetDir` (cria se necessário). Em Windows usa
 * `Expand-Archive` (PowerShell), em outras plataformas tenta `unzip`. Devolve
 * `true` em caso de sucesso, `false` se nenhum método estiver disponível ou
 * falhar.
 */
function unzipFile(zipPath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  if (process.platform === "win32") {
    try {
      const ps = [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`,
      ];
      execFileSync("powershell.exe", ps, { stdio: "ignore", timeout: 120_000 });
      return true;
    } catch (e) {
      dlog(`Expand-Archive falhou em ${zipPath}: ${e?.message || e}`);
      // Tenta `tar -xf` (Win10+ inclui bsdtar e suporta zip).
      try {
        const r = spawnSync("tar", ["-xf", zipPath, "-C", targetDir], {
          stdio: "ignore",
          timeout: 120_000,
        });
        if (r.status === 0) return true;
      } catch (e2) {
        dlog(`tar -xf falhou em ${zipPath}: ${e2?.message || e2}`);
      }
      return false;
    }
  }
  try {
    const r = spawnSync("unzip", ["-o", zipPath, "-d", targetDir], {
      stdio: "ignore",
      timeout: 120_000,
    });
    return r.status === 0;
  } catch (e) {
    dlog(`unzip falhou em ${zipPath}: ${e?.message || e}`);
    return false;
  }
}

/**
 * Descomprime todos os ZIPs novos em `outputDir` para subpastas do mesmo
 * `outputDir` (`<zipBaseName>/`). Devolve número de ZIPs processados com
 * sucesso. Cada ZIP descomprimido é renomeado para `<orig>.processed` para
 * não ser re-processado em iterações seguintes.
 */
function ingestZipDownloads(outputDir, sinceMs) {
  const zips = listFilesByExt(outputDir, sinceMs, [".zip"]);
  let ok = 0;
  for (const zip of zips) {
    const targetSub = path.join(outputDir, path.basename(zip, path.extname(zip)));
    if (unzipFile(zip, targetSub)) {
      try {
        fs.renameSync(zip, `${zip}.processed`);
      } catch {
        /* ignore */
      }
      ok += 1;
      dlog(`zip descomprimido: ${path.basename(zip)} -> ${targetSub}`);
    }
  }
  return ok;
}

/**
 * Procura ZIPs novos em `Downloads/` do utilizador (fallback caso a extensão
 * tenha ignorado `download.default_directory`). Move-os para `outputDir` e
 * descomprime. Devolve número de ZIPs movidos.
 */
function ingestZipsFromUserDownloads(outputDir, sinceMs) {
  const dl = userDownloadsDir();
  if (!dl) return 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dl, { withFileTypes: true });
  } catch {
    return 0;
  }
  let moved = 0;
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const lower = ent.name.toLowerCase();
    if (!lower.endsWith(".zip")) continue;
    const src = path.join(dl, ent.name);
    let st;
    try {
      st = fs.statSync(src);
    } catch {
      continue;
    }
    if (st.mtimeMs < sinceMs) continue;
    // Heurística: nomes típicos da extensão começam por «NFSe-» / «NFS-e» / contêm CNPJ.
    const looksLikeNfse = /nfs[-_]?e|nfse|notas|emitidas|recebidas/i.test(ent.name);
    if (!looksLikeNfse) continue;
    const dest = path.join(outputDir, ent.name);
    try {
      fs.copyFileSync(src, dest);
      // Tenta apagar o original para não re-processar; se falhar, marca-o.
      try {
        fs.unlinkSync(src);
      } catch {
        try {
          fs.renameSync(src, `${src}.adn-imported`);
        } catch {
          /* ignore */
        }
      }
      moved += 1;
      dlog(`zip movido de Downloads para outputDir: ${ent.name}`);
    } catch (e) {
      dlog(`falha ao mover ${ent.name} de Downloads: ${e?.message || e}`);
    }
  }
  return moved;
}

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
      /* tentar próximo */
    }
  }
  return false;
}

/**
 * Aguarda chegar a uma página do Emissor Nacional já autenticada (Dashboard ou listagens).
 */
async function waitForAuthenticatedPortal(page, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    if (
      /\/EmissorNacional(\/?(Dashboard|Notas|Emitidas|Recebidas)?\b)/i.test(url) &&
      !/\/Login/i.test(url)
    ) {
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("timeout a aguardar autenticação no portal NFS-e.");
}

/**
 * Pilota o popup: marca tipoNota, preenche datas, garante XML, dispara download.
 *
 * Notas críticas:
 *   - O click no `#startDownloadBtn` é feito com `.click({ force: true })` em vez
 *     de `dispatchEvent("click")` — alguns handlers `addEventListener` registados
 *     pela extensão ignoram `dispatchEvent` (event order / `isTrusted` checks).
 *   - Após preencher as datas, dispara `input` + `change` + `blur` — alguns
 *     scripts da extensão só validam em `blur`.
 *   - Capturamos o estado inicial do `#status` da extensão para sabermos se ela
 *     pediu ao utilizador algum input ou bloqueou (ex.: janela demasiado grande).
 */
async function driveExtensionPopup(popupPage, { tipoNota, dateFrom, dateTo }) {
  await popupPage
    .waitForSelector("#startDownloadBtn", { timeout: 30_000 })
    .catch(() => {
      throw new Error(
        "popup.html não expôs #startDownloadBtn (extensão actualizada? rever sync-adn-extension-from-chrome).",
      );
    });

  /** Activa o tipo de nota sem disparar `navigateToPortal` (que mudaria a aba activa). */
  await popupPage.evaluate((tipo) => {
    document.body.setAttribute("data-nfse-type", tipo);
    const sel = document.querySelector(
      `.nfse-type-btn[href*="${tipo === "Recebidas" ? "Recebidas" : "Emitidas"}"]`,
    );
    if (sel) {
      document
        .querySelectorAll(".nfse-type-btn")
        .forEach((b) => b.classList.remove("selected"));
      sel.classList.add("selected");
    }
  }, tipoNota);

  /** Preenche datas (input type=date aceita YYYY-MM-DD) com input + change + blur. */
  for (const [sel, val] of [["#dateStart", dateFrom], ["#dateEnd", dateTo]]) {
    const loc = popupPage.locator(sel);
    await loc.fill(val);
    await loc.dispatchEvent("input");
    await loc.dispatchEvent("change");
    await loc.evaluate((el) => el.blur && el.blur());
  }

  /** Garante radio XML (default já é XML, mas reforçamos). */
  await popupPage.evaluate(() => {
    const r = document.querySelector('input[name="downloadType"][value="xml"]');
    if (r) {
      r.checked = true;
      r.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  /** Snapshot inicial do estado do popup (#status, disabled state do botão). */
  const initial = await popupPage.evaluate(() => {
    const btn = document.querySelector("#startDownloadBtn");
    const st = document.querySelector("#status");
    return {
      buttonDisabled: btn ? !!btn.disabled : null,
      buttonText: btn ? (btn.textContent || "").trim().slice(0, 80) : "",
      statusText: st ? (st.textContent || "").trim().slice(0, 200) : "",
      dateStartValue: (document.querySelector("#dateStart") || {}).value || "",
      dateEndValue: (document.querySelector("#dateEnd") || {}).value || "",
    };
  });
  process.stderr.write(
    `[adn-playwright-motor] popup pré-click: btn_disabled=${initial.buttonDisabled} ` +
      `btn_text=${JSON.stringify(initial.buttonText)} ` +
      `status=${JSON.stringify(initial.statusText)} ` +
      `date_start=${initial.dateStartValue} date_end=${initial.dateEndValue}\n`,
  );

  /**
   * Click real (force=true salta verificações de visibilidade/overlay; o popup foi
   * aberto numa aba normal, sem bringToFront, mas o handler precisa que o evento
   * tenha `isTrusted=true` — só `click()` do Playwright dá isso).
   */
  await popupPage.locator("#startDownloadBtn").click({ force: true, timeout: 10_000 });
  process.stderr.write("[adn-playwright-motor] click em #startDownloadBtn enviado.\n");
}

/**
 * Pilota a extensão com **retry automático** se o popup recusar com
 * `period_over_12_months`. Cada retry encolhe a janela pelo lado do `from` em
 * N dias (default 14) até a extensão aceitar OU esgotar tentativas.
 *
 * Devolve a janela efectivamente aceite (pode ser menor que a pedida) para que
 * o log e o `summaryJson` reflictam o que o motor realmente buscou.
 */
async function driveExtensionPopupWithRetry(popupPage, { tipoNota, dateFrom, dateTo }) {
  const maxRetries = Math.max(
    0,
    Number.parseInt(process.env.ADN_BROWSER_PERIOD_RETRIES || "3", 10) || 3,
  );
  const shrinkStepDays = Math.max(
    1,
    Number.parseInt(process.env.ADN_BROWSER_PERIOD_SHRINK_DAYS || "14", 10) || 14,
  );

  let currentFrom = dateFrom;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      process.stderr.write(
        `[adn-playwright-motor] retry ${attempt}/${maxRetries}: janela anterior recusada, ` +
          `a tentar dateFrom=${currentFrom} dateTo=${dateTo}.\n`,
      );
    }
    await driveExtensionPopup(popupPage, { tipoNota, dateFrom: currentFrom, dateTo });

    // Pausa curta para o popup processar o click e (eventualmente) mostrar erro.
    await new Promise((r) => setTimeout(r, 2500));
    const err = await popupBlockingError(popupPage);
    if (err !== "period_over_12_months") {
      return { dateFrom: currentFrom, dateTo, attempts: attempt + 1, blocked: err };
    }
    if (attempt === maxRetries) {
      process.stderr.write(
        `[adn-playwright-motor] esgotadas ${maxRetries} tentativas de encolher janela; ` +
          `extensão continua a recusar com period_over_12_months.\n`,
      );
      return {
        dateFrom: currentFrom,
        dateTo,
        attempts: attempt + 1,
        blocked: err,
      };
    }
    const fromD = parseLocalIsoDate(currentFrom);
    fromD.setDate(fromD.getDate() + shrinkStepDays);
    currentFrom = fmtIsoDate(fromD);
  }
  return { dateFrom: currentFrom, dateTo, attempts: maxRetries + 1 };
}

/**
 * Lê o `#status` actual do popup (texto curto + se o botão ficou disabled — sinal
 * que a extensão começou a processar). Tolerante a popup fechado.
 */
async function readPopupStatus(popupPage) {
  try {
    return await popupPage.evaluate(() => {
      const btn = document.querySelector("#startDownloadBtn");
      const st = document.querySelector("#status");
      return {
        buttonDisabled: btn ? !!btn.disabled : null,
        statusText: st ? (st.textContent || "").trim().slice(0, 200) : "",
      };
    });
  } catch {
    return { buttonDisabled: null, statusText: "" };
  }
}

/**
 * Captura screenshot + HTML do popup quando o motor termina sem artefactos.
 * Útil para descobrir se a extensão mostrou um erro («Sessão expirada»,
 * «Janela máxima 31 dias», etc.) que não capturámos no `#status`.
 */
async function capturePopupDiagnostics(popupPage, outputDir) {
  if (!popupPage) return null;
  const diagDir = path.join(outputDir, "_diag");
  fs.mkdirSync(diagDir, { recursive: true });
  const ts = Date.now();
  const shot = path.join(diagDir, `popup-${ts}.png`);
  const html = path.join(diagDir, `popup-${ts}.html`);
  let info = `screenshot=${shot}`;
  try {
    await popupPage.screenshot({ path: shot, fullPage: true });
  } catch (e) {
    info += ` (screenshot falhou: ${e?.message || e})`;
  }
  try {
    const body = await popupPage.evaluate(() => document.documentElement.outerHTML);
    fs.writeFileSync(html, body, "utf8");
    info += ` html=${html}`;
  } catch (e) {
    info += ` (html falhou: ${e?.message || e})`;
  }
  return info;
}

async function popupSaysSemNotas(popupPage) {
  try {
    const text = await popupPage.evaluate(() => {
      const s = document.getElementById("status");
      return s ? s.textContent || "" : "";
    });
    return /sem\s+notas|nenhuma\s+nfs|0\s+notas\s+encontradas/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Detecta erros bloqueantes no popup que tornam inútil esperar mais (período
 * inválido, sessão expirada, etc.). Lê o texto **completo** do popup (não só
 * `#status`) porque a extensão coloca este aviso num elemento separado.
 */
async function popupBlockingError(popupPage) {
  try {
    const text = await popupPage.evaluate(() => document.body.innerText || "");
    if (/per[íi]odo\s+m[áa]ximo\s+permitido[:\s]*12\s+meses/i.test(text)) {
      return "period_over_12_months";
    }
    if (/sess[ãa]o\s+expirou|fa[çc]a\s+login\s+novamente/i.test(text)) {
      return "session_expired";
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Devolve a lista de IDs de extensões com service worker / background page activos.
 */
function listKnownExtensionIds(context) {
  const ids = new Set();
  try {
    const swList = typeof context.serviceWorkers === "function" ? context.serviceWorkers() : [];
    for (const sw of swList) {
      const url = (sw.url && sw.url()) || "";
      const m = /^chrome-extension:\/\/([a-p]{32})\//.exec(url);
      if (m) ids.add(m[1]);
    }
    const bgList = typeof context.backgroundPages === "function" ? context.backgroundPages() : [];
    for (const bg of bgList) {
      const url = (bg.url && bg.url()) || "";
      const m = /^chrome-extension:\/\/([a-p]{32})\//.exec(url);
      if (m) ids.add(m[1]);
    }
  } catch {
    /* ignore */
  }
  return [...ids];
}

/**
 * Espera pela extensão com o ID `expectedId` (ex.: «Baixar NFSe») a ficar activa.
 * Em manifest v3 isso significa um service worker em `chrome-extension://<expectedId>/`.
 * Devolve o próprio `expectedId` se aparecer; `null` ao fim de `timeoutMs`.
 */
async function waitForExtensionId(context, expectedId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (listKnownExtensionIds(context).includes(expectedId)) {
      return expectedId;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

/**
 * Captura `chrome://policy` e `chrome://extensions` para um ficheiro de log e screenshots
 * em `outputDir/_diag/`, devolvendo um pequeno resumo textual para incluir no stderr.
 */
async function captureDiagnostics(context, outputDir) {
  const diagDir = path.join(outputDir, "_diag");
  fs.mkdirSync(diagDir, { recursive: true });
  const lines = [];
  for (const url of ["chrome://policy", "chrome://extensions"]) {
    let page;
    try {
      page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await new Promise((r) => setTimeout(r, 1500));
      const safeName = url.replace(/[^a-z]/gi, "_");
      const shotPath = path.join(diagDir, `${safeName}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      const bodyText = (
        await page.evaluate(() => document.body && document.body.innerText)
      ).slice(0, 4000);
      const txtPath = path.join(diagDir, `${safeName}.txt`);
      fs.writeFileSync(txtPath, bodyText, "utf8");
      lines.push(`[diag] ${url} -> ${shotPath}`);
    } catch (e) {
      lines.push(`[diag] ${url} falhou: ${e?.message || e}`);
    } finally {
      try {
        if (page) await page.close();
      } catch {
        /* ignore */
      }
    }
  }
  return lines.join("\n");
}

/**
 * Mensagem de diagnóstico quando o popup falha — em Chrome 137+ a única via fiável é
 * a policy `ExtensionInstallForcelist` (configurada pelo worker Python). A pasta unpacked
 * é só fallback para Chromium for Testing.
 */
function manifestHintFromExtDir(extDir) {
  const policyHint =
    "[hint] Verifique a policy HKCU\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist " +
    "(executar `gpupdate /force` ou reiniciar Chrome). Em chrome://policy a entrada deve estar " +
    "marcada como aplicada. Sem a policy, Chrome 137+ não carrega extensões via --load-extension.";
  try {
    if (!extDir) return policyHint;
    const manifestPath = path.join(extDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return `[hint] ${manifestPath} NÃO EXISTE; ${policyHint}`;
    }
    const meta = path.join(extDir, "_metadata");
    if (fs.existsSync(meta)) {
      return `[hint] Pasta ${meta} existe — Chrome rejeita como unpacked. Apague essa pasta. ${policyHint}`;
    }
    return policyHint;
  } catch (e) {
    return `[hint] não consegui inspeccionar ${extDir}: ${e?.message || e}; ${policyHint}`;
  }
}

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

function resolveDateWindow() {
  const envFrom = (process.env.ADN_BROWSER_FETCH_FROM || "").trim();
  const envTo = (process.env.ADN_BROWSER_FETCH_TO || "").trim();
  const today = new Date();
  const to = envTo && /^\d{4}-\d{2}-\d{2}$/.test(envTo) ? envTo : fmtIsoDate(today);
  let from = envFrom;
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const days = Math.max(
      1,
      Math.min(365, Number.parseInt(process.env.ADN_BROWSER_FETCH_DAYS || "31", 10) || 31),
    );
    const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    from = fmtIsoDate(start);
  }
  return { from, to };
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
  const waitArtifactsSec = Math.max(
    30,
    Number.parseInt(process.env.ADN_BROWSER_WAIT_ARTIFACTS_SEC || "600", 10) || 600,
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

  dlog(`jobId=${opts.jobId} cnpj=${opts.cnpjDigits}`);
  dlog(`loginUrl=${loginUrl}`);
  dlog(`profileDir=(definido)`);
  dlog(`extensionDir=(definido)`);
  dlog(`headless=${headless} channel=${channel || "bundled-chromium"}`);
  dlog(`tipoNota=${tipoNota} dateFrom=${dateFrom} dateTo=${dateTo}`);
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

  try {
    await driveExtensionPopup(popupPage, { tipoNota, dateFrom, dateTo });
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
      dlog(
        `artefactos XML novos (parcial): ${xmls.length} ` +
          `(zips_extraidos=${totalZipsIngested} zips_de_downloads=${totalZipsFromDownloads})`,
      );
    }
    found = xmls.length;
    /** Se já há ficheiros e nada novo durante `idleSettleSec`, considera concluído. */
    if (found > 0 && Date.now() - lastChange >= idleSettleSec * 1000) {
      break;
    }
    /** Atalho: se popup mostra mensagem clara de «sem notas», sai sem erro. */
    try {
      const semNotas = await popupSaysSemNotas(popupPage);
      if (semNotas) {
        dlog("popup sinalizou ausência de notas no período; saindo sem erro.");
        await context.close().catch(() => {});
        process.exit(0);
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

  await context.close().catch(() => {});

  if (found === 0) {
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
        `zips_extraidos=${totalZipsIngested} zips_de_downloads=${totalZipsFromDownloads}\n`,
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

  /** Preenche datas (input type=date aceita YYYY-MM-DD). */
  await popupPage.locator("#dateStart").fill(dateFrom);
  await popupPage.locator("#dateStart").dispatchEvent("change");
  await popupPage.locator("#dateEnd").fill(dateTo);
  await popupPage.locator("#dateEnd").dispatchEvent("change");

  /** Garante radio XML (default já é XML, mas reforçamos). */
  await popupPage.evaluate(() => {
    const r = document.querySelector('input[name="downloadType"][value="xml"]');
    if (r) {
      r.checked = true;
      r.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  /** Click no «Iniciar Download». dispatchEvent para não trazer o popup à frente. */
  await popupPage.locator("#startDownloadBtn").dispatchEvent("click");
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

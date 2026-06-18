#!/usr/bin/env node
/**
 * Patch da extensão «Baixar NFSe» para automação Playwright.
 *
 * Problema: em Chrome for Testing, o `fetch()` do popup (chrome-extension://)
 * muitas vezes NÃO envia os cookies de sessão do portal → 0 XML baixados,
 * chrome://downloads vazio, popup «0 baixada(s) de N encontrada(s)».
 *
 * Solução: `portalFetch` em modo normal passa a buscar XML/PDF via
 * `chrome.scripting.executeScript` na aba https://www.nfse.gov.br/* (mesma
 * técnica do modo anónimo).
 *
 * Uso:
 *   node scripts/patch-adn-extension-automation.mjs
 *   node scripts/patch-adn-extension-automation.mjs C:\adn\extensao
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER_V1 = "ADN_AUTOMATION_PATCH v1";
const MARKER_V2 = "ADN_AUTOMATION_PATCH v2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(__dirname, "..", ".local", "adn-browser-extension");
const extDir = path.resolve(process.argv[2] || process.env.ADN_BROWSER_EXTENSION_DIR || defaultDir);
const popupPath = path.join(extDir, "popup.js");

if (!fs.existsSync(popupPath)) {
  console.error(`[patch-adn] popup.js não encontrado em: ${popupPath}`);
  process.exit(1);
}

let src = fs.readFileSync(popupPath, "utf8");
if (src.includes(MARKER_V2)) {
  console.log(`[patch-adn] Já aplicado (${MARKER_V2}) em ${popupPath}`);
  process.exit(0);
}

const helper = `
  // ${MARKER_V2}
  async function _getNormalPortalTabId() {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://www.nfse.gov.br/*' });
      const normal = tabs.find((t) => !t.incognito);
      const tabId = normal ? normal.id : tabs[0] ? tabs[0].id : null;
      if (!tabId) console.warn('[ADN patch] nenhuma aba nfse.gov.br aberta');
      return tabId;
    } catch (e) {
      console.warn('[ADN patch] _getNormalPortalTabId:', e);
      return null;
    }
  }

  async function _portalFetchViaTab(tabId, fetchUrl) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (url) => {
        try {
          const resp = await fetch(url, { credentials: 'include', redirect: 'follow' });
          const ct = (resp.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('pdf') || ct.includes('octet-stream')) {
            const buf = await resp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return { ok: resp.ok, status: resp.status, url: resp.url, b64: btoa(bin), binary: true };
          }
          const text = await resp.text();
          return { ok: resp.ok, status: resp.status, url: resp.url, text, binary: false };
        } catch (e) {
          return { ok: false, status: 0, url, error: e.message };
        }
      },
      args: [fetchUrl],
    });
    const result = results?.[0]?.result;
    if (!result || result.error) {
      console.warn('[ADN patch] fetch FAIL', fetchUrl.slice(-80), result?.error || 'empty');
      throw new Error(result?.error || 'Erro ao buscar dados do portal (aba NFS-e).');
    }
    if (!result.ok) {
      console.warn('[ADN patch] fetch HTTP', result.status, fetchUrl.slice(-80));
    }
    if (result.binary) {
      const bin = atob(result.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ab = bytes.buffer;
      return {
        ok: result.ok,
        status: result.status,
        url: result.url,
        text: async () => new TextDecoder().decode(ab),
        arrayBuffer: async () => ab,
      };
    }
    return {
      ok: result.ok,
      status: result.status,
      url: result.url,
      text: async () => result.text,
      arrayBuffer: async () => new TextEncoder().encode(result.text).buffer,
    };
  }
`;

const oldReturn = "    return fetch(url, { credentials: 'include', ...options });";
const newReturn = `    const tabIdNormal = await _getNormalPortalTabId();
    if (tabIdNormal) {
      console.log('[ADN patch] portalFetch via tabId=' + tabIdNormal);
      return _portalFetchViaTab(tabIdNormal, url);
    }
    console.warn('[ADN patch] portalFetch SEM aba nfse.gov.br — fallback popup (provavelmente falha)');
    return fetch(url, { credentials: 'include', ...options });`;

if (src.includes(MARKER_V1)) {
  /** Upgrade v1 → v2: substituir bloco helper e marcador. */
  const v1Start = src.indexOf(`// ${MARKER_V1}`);
  const fetchComment = "  // Fetch que funciona em contexto normal e anônimo";
  const v1End = src.indexOf(fetchComment, v1Start);
  if (v1Start === -1 || v1End === -1) {
    console.error("[patch-adn] v1 detectado mas bloco helper não encontrado — edite popup.js manualmente.");
    process.exit(1);
  }
  src = src.slice(0, v1Start) + helper.trimStart() + "\n\n" + src.slice(v1End);
  if (!src.includes(newReturn.split("\n")[0])) {
    src = src.replace(oldReturn, newReturn);
  }
  fs.writeFileSync(popupPath, src, "utf8");
  console.log(`[patch-adn] Upgrade v1→v2 aplicado em ${popupPath}`);
  process.exit(0);
}

if (!src.includes(oldReturn)) {
  console.error("[patch-adn] popup.js não tem o trecho esperado — versão da extensão diferente?");
  process.exit(1);
}

src = src.replace(
  "  // Fetch que funciona em contexto normal e anônimo",
  `${helper}\n  // Fetch que funciona em contexto normal e anônimo`,
);
src = src.replace(oldReturn, newReturn);

fs.writeFileSync(popupPath, src, "utf8");
console.log(`[patch-adn] Patch aplicado (${MARKER_V2}) em ${popupPath}`);

// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// Background script para gerenciar downloads
// Continua rodando mesmo quando o popup é fechado

// Seed de integridade do módulo de serviço
const _swIntegrity = { _ck: 0x1C28, _dt: 0x134B2C7, _id: 'ZW5laG1jbGFq' };

// Modo pasta customizada (File System Access API, escrita via popup)
let customFolderMode = false;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Keep-alive: mantém o service worker ativo durante downloads longos
// Chrome MV3 encerra o service worker após ~5min de inatividade
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    // Qualquer chamada à API do Chrome reseta o timer de inatividade
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000); // A cada 20 segundos
  console.log('[KeepAlive] Iniciado');
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[KeepAlive] Parado');
  }
  stopSessionKeepAlive();
}

// Session keep-alive: mantém a sessão do portal ativa durante downloads longos
// Faz um fetch leve ao dashboard a cada 4 minutos para renovar a sessão
let sessionKeepAliveInterval = null;

function startSessionKeepAlive() {
  if (sessionKeepAliveInterval) return;
  sessionKeepAliveInterval = setInterval(async () => {
    try {
      const response = await portalFetch('https://www.nfse.gov.br/EmissorNacional/', {
        redirect: 'follow'
      });
      const isLoggedIn = !response.url.includes('/Login');
      if (isLoggedIn) {
        console.log('[SessionKeepAlive] Sessão renovada');
      } else {
        console.warn('[SessionKeepAlive] Sessão expirou!');
        // Avisa o popup que a sessão expirou
        chrome.runtime.sendMessage({
          action: 'sessionExpiredWarning',
          message: 'A sessão do portal expirou. Faça login novamente para continuar.'
        }).catch(() => {});
        stopSessionKeepAlive();
      }
    } catch (error) {
      console.error('[SessionKeepAlive] Erro ao renovar sessão:', error);
    }
  }, 4 * 60 * 1000); // A cada 4 minutos
  console.log('[SessionKeepAlive] Iniciado');
}

function stopSessionKeepAlive() {
  if (sessionKeepAliveInterval) {
    clearInterval(sessionKeepAliveInterval);
    sessionKeepAliveInterval = null;
    console.log('[SessionKeepAlive] Parado');
  }
}

// Abre o painel lateral quando o usuário clica no ícone da extensão
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ==========================================
// URLs do portal NFSe
// ==========================================
const PORTAL_ORIGIN = 'https://www.nfse.gov.br';
const PORTAL_URLS = {
  emitidas: PORTAL_ORIGIN + '/EmissorNacional/Notas/Emitidas',
  recebidas: PORTAL_ORIGIN + '/EmissorNacional/Notas/Recebidas',
  dashboard: PORTAL_ORIGIN + '/EmissorNacional/',
  login: PORTAL_ORIGIN + '/EmissorNacional/Login'
};

// ==========================================
// Suporte a aba anônima (incognito)
// ==========================================
// No modo "spanning", o service worker roda no contexto normal.
// Fetches com credentials:'include' usam cookies do contexto normal, não do anônimo.
// Para funcionar em aba anônima, executamos os fetches dentro da aba ativa (que está no portal NFSe)
// via chrome.scripting.executeScript, aproveitando os cookies da sessão anônima.

// Flag global: indica se o contexto atual é anônimo
let isIncognitoContext = false;

// Busca UM arquivo via executeScript na aba anônima (usado por downloadFile individual)
async function fetchFileViaTab(tabId, url) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (fileUrl) => {
        try {
          const resp = await fetch(fileUrl, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };
          const blob = await resp.blob();
          return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ dataUrl: reader.result });
            reader.onerror = () => resolve({ error: 'Erro ao ler arquivo' });
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return { error: e.message };
        }
      },
      args: [url]
    });
    return results?.[0]?.result || { error: 'Sem resultado' };
  } catch (error) {
    return { error: error.message };
  }
}

// Busca um LOTE de arquivos via um único executeScript (muito mais eficiente)
// urls = array de strings. Retorna array de { url, dataUrl } ou { url, error }
async function fetchFilesBatchViaTab(tabId, urls) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (fileUrls) => {
        const results = [];
        // Processa em paralelo dentro da aba (máximo 4 simultâneos para não sobrecarregar)
        const CONCURRENT = 4;
        for (let i = 0; i < fileUrls.length; i += CONCURRENT) {
          const batch = fileUrls.slice(i, i + CONCURRENT);
          const batchResults = await Promise.allSettled(batch.map(async (fileUrl) => {
            const resp = await fetch(fileUrl, { credentials: 'include' });
            if (!resp.ok) return { url: fileUrl, error: `HTTP ${resp.status}` };
            const blob = await resp.blob();
            return await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve({ url: fileUrl, dataUrl: reader.result });
              reader.onerror = () => resolve({ url: fileUrl, error: 'Erro ao ler arquivo' });
              reader.readAsDataURL(blob);
            });
          }));
          for (let j = 0; j < batchResults.length; j++) {
            const r = batchResults[j];
            if (r.status === 'fulfilled') {
              results.push(r.value);
            } else {
              results.push({ url: batch[j] || '', error: r.reason?.message || 'Erro desconhecido' });
            }
          }
        }
        return results;
      },
      args: [urls]
    });
    return results?.[0]?.result || [];
  } catch (error) {
    console.error('[Incognito] Erro ao buscar lote de arquivos:', error);
    return urls.map(u => ({ url: u, error: error.message }));
  }
}

// Busca o ID da aba anônima que está no portal NFSe
async function getIncognitoPortalTabId() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.nfse.gov.br/*' });
    // Prioriza aba anônima
    const incognitoTab = tabs.find(t => t.incognito);
    return incognitoTab ? incognitoTab.id : (tabs[0] ? tabs[0].id : null);
  } catch (error) {
    console.error('[Incognito] Erro ao buscar aba do portal:', error);
    return null;
  }
}

// Executa fetch dentro da aba do portal (usa os cookies da aba anônima)
async function fetchViaTab(tabId, url, timeoutMs = 30000) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (fetchUrl, timeout) => {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), timeout);
          const resp = await fetch(fetchUrl, {
            credentials: 'include',
            redirect: 'follow',
            signal: controller.signal
          });
          clearTimeout(tid);
          const text = await resp.text();
          return { ok: resp.ok, status: resp.status, url: resp.url, text: text };
        } catch (e) {
          return { ok: false, status: 0, url: fetchUrl, text: '', error: e.name === 'AbortError' ? 'Timeout' : e.message };
        }
      },
      args: [url, timeoutMs]
    });
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    return { ok: false, status: 0, url: url, text: '', error: 'Sem resultado do executeScript' };
  } catch (error) {
    console.error('[Incognito] Erro ao executar fetch via tab:', error);
    return { ok: false, status: 0, url: url, text: '', error: error.message };
  }
}

// Fetch que funciona tanto em contexto normal quanto anônimo
// Retorna um objeto compatível com Response para o código existente
// Em modo anônimo, options.signal é ignorado (timeout é gerenciado internamente)
async function portalFetch(url, options = {}) {
  if (isIncognitoContext) {
    const tabId = await getIncognitoPortalTabId();
    if (!tabId) {
      throw new Error('Não foi possível encontrar a aba do portal NFS-e. Abra o portal em uma aba anônima.');
    }
    const timeoutMs = options._timeout || 30000;
    const result = await fetchViaTab(tabId, url, timeoutMs);
    if (result.error) {
      const err = new Error(result.error);
      if (result.error === 'Timeout') err.name = 'AbortError';
      throw err;
    }
    // Retorna um objeto que simula a Response do fetch
    return {
      ok: result.ok,
      status: result.status,
      url: result.url,
      text: async () => result.text,
      json: async () => JSON.parse(result.text)
    };
  } else {
    // Em modo normal: usa credentials:'include' como antes
    return fetch(url, { credentials: 'include', ...options });
  }
}

// ==========================================
// Verificação de sessão
// ==========================================
async function checkSession() {
  try {
    const response = await portalFetch(PORTAL_URLS.dashboard, {
      redirect: 'follow'
    });
    // Se a URL final contém /Login, não está logado (redirecionou)
    const isLoggedIn = !response.url.includes('/Login');
    console.log(`[Session] Verificação: ${isLoggedIn ? 'logado' : 'não logado'} (URL: ${response.url})`);
    return isLoggedIn;
  } catch (error) {
    // Em modo anônimo, "aba não encontrada" é esperado quando o portal não está aberto
    if (isIncognitoContext && error.message && error.message.includes('encontrar a aba')) {
      console.log('[Session] Portal NFS-e não está aberto na aba anônima');
    } else {
      console.error('[Session] Erro ao verificar sessão:', error);
    }
    return false;
  }
}

// ==========================================
// Cache de dados extraídos (válido por 5 minutos)
// ==========================================
const extractCache = {
  data: null,
  timestamp: null,
  key: null,
  CACHE_DURATION: 5 * 60 * 1000
};

function getCacheKey(dateStart, dateEnd, type, tipoNota, buscarManifestacoes = false) {
  return `${dateStart}_${dateEnd}_${type}_${tipoNota}_${buscarManifestacoes ? 'manif' : 'normal'}`;
}

function isCacheValid(key) {
  if (!extractCache.data || !extractCache.timestamp || extractCache.key !== key) return false;
  return (Date.now() - extractCache.timestamp) < extractCache.CACHE_DURATION;
}

function saveToCache(key, data) {
  extractCache.key = key;
  // Salva cópia limpa dos links (sem classificação de eventos que possa ser adicionada depois)
  extractCache.data = data.map(link => ({ ...link }));
  extractCache.timestamp = Date.now();
  console.log(`[Cache] Salvo: ${data.length} registros`);
}

// ==========================================
// Offscreen document para parsing de HTML
// ==========================================
let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;

  // Verifica se já existe um offscreen document
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  // Cria o offscreen document para parsing DOM
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Parsing de HTML do portal NFSe para extração de links de download'
  });
  offscreenCreated = true;
  console.log('[Offscreen] Documento criado para parsing DOM');
}

// Envia HTML para o offscreen document e recebe os dados parseados
async function parseHtmlViaOffscreen(html, type) {
  await ensureOffscreen();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'parsePageHtml',
      html: html,
      type: type,
      portalOrigin: PORTAL_ORIGIN
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Offscreen] Erro:', chrome.runtime.lastError.message);
        resolve({ links: [], hasNext: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { links: [], hasNext: false });
      }
    });
  });
}

// Envia HTML para o offscreen document e extrai nome da empresa
async function parseCompanyNameViaOffscreen(html) {
  await ensureOffscreen();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'parseCompanyName',
      html: html
    }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(response?.companyName || null);
      }
    });
  });
}

// Classifica situação da NFS-e baseado nos eventos encontrados na página de visualização
// Prioridade: manifestação > cancelamento por substituição > cancelamento
// Retorna subtipo para criar subpastas (ex: Manifestacao/Rejeicao do Tomador/)
function classifyByEventos(eventos) {
  let resultado = null;

  for (const evento of eventos) {
    const lower = evento.toLowerCase();

    // Manifestação tem prioridade máxima — se encontrar, retorna imediatamente
    if (lower.includes('manifestação')) {
      // Extrai: "Manifestação de NFS-e - Rejeição do Tomador" → "Rejeicao do Tomador"
      const match = evento.match(/manifestação\s+de\s+nfs-e\s*-\s*(.+)/i);
      const subtipo = match ? match[1].trim() : 'Outros';
      return { situacao: 'manifestacao', subtipoEvento: subtipo };
    }

    // Cancelamento por Substituição (só guarda se ainda não tem resultado)
    if (!resultado && lower.includes('cancelamento') && lower.includes('substituição')) {
      resultado = { situacao: 'substituida', subtipoEvento: 'Substituida' };
      continue;
    }

    // Cancelamento simples
    if (!resultado && lower.includes('cancelamento')) {
      resultado = { situacao: 'cancelada', subtipoEvento: 'Cancelada' };
      continue;
    }
  }

  return resultado || { situacao: 'normal', subtipoEvento: '' };
}

// Extrai eventos do HTML via regex (sem DOMParser, roda direto no service worker)
// Mais rápido que enviar para offscreen — elimina round-trip de mensagem
function parseEventosRegex(html) {
  const eventos = [];
  // Busca <h3 class="panel-title"> dentro de blocos pnlSujeito
  // O texto do evento fica entre as tags <h3> (após eventual <i>)
  const regex = /pnlSujeito[\s\S]*?<h3[^>]*class="[^"]*panel-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    // Remove tags internas (<i>, <span>, etc.) e limpa espaços
    const text = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) eventos.push(text);
  }
  return eventos;
}

// Busca página de visualização de cada nota para classificar por eventos
// Velocidade máxima: 6 paralelos, sem delay, parsing direto via regex
// modoManifestacoes=true: verifica TODAS as notas (não só normais)
async function fetchEventosForLinks(links, onProgress, modoManifestacoes = false) {
  const CONCURRENT_FETCHES = 6;  // Limite do Chrome (6 conexões/domínio HTTP/1.1)
  const FETCH_TIMEOUT = 8000;    // 8s timeout agressivo
  const MAX_RETRIES = 1;         // 1 retry rápido (2 tentativas total)

  // Modo manifestações: verifica TODAS as notas com chave válida
  // Modo normal: só verifica notas 'normal' (cancelada/substituída já classificadas pela tabela)
  const linksToCheck = modoManifestacoes
    ? links.filter(l => l.chave && l.chave.length >= 30)
    : links.filter(l => l.situacao === 'normal' && l.chave && l.chave.length >= 30);
  const totalToCheck = linksToCheck.length;

  if (totalToCheck === 0) {
    console.log('[Eventos] Nenhuma nota para verificar eventos');
    return links;
  }

  console.log(`[Eventos] Verificando eventos de ${totalToCheck} nota(s)${modoManifestacoes ? ' (modo manifestações - todas)' : ` (${links.length - totalToCheck} já classificadas)`}`);
  let processed = 0;
  let failedCount = 0;
  let sessionExpired = false;

  for (let i = 0; i < linksToCheck.length; i += CONCURRENT_FETCHES) {
    if (sessionExpired) break;

    const batch = linksToCheck.slice(i, i + CONCURRENT_FETCHES);

    const results = await Promise.allSettled(batch.map(async (linkData) => {
      const vizUrl = `${PORTAL_ORIGIN}/EmissorNacional/Notas/Visualizar/Index/${linkData.chave}`;

      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        try {
          let response;
          if (isIncognitoContext) {
            response = await portalFetch(vizUrl, { _timeout: FETCH_TIMEOUT });
          } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
            try {
              response = await portalFetch(vizUrl, { signal: controller.signal });
            } finally {
              clearTimeout(timeoutId);
            }
          }

          if (!response.ok) {
            if (retry < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
            failedCount++;
            console.warn(`[Eventos] HTTP ${response.status} para chave ${linkData.chave}`);
            break;
          }

          const html = await response.text();

          // Detecta sessão expirada
          const htmlLower = html.toLowerCase();
          const isLoginPage = (
            htmlLower.includes('action="/emissornacional/login"') ||
            htmlLower.includes('action="/emissornacional/login/')
          );
          const hasEventosData = htmlLower.includes('pnlsujeito') || htmlLower.includes('panel-title') || htmlLower.includes('dados-nfse');
          if (isLoginPage && !hasEventosData) {
            throw new Error('SESSION_EXPIRED');
          }

          // Parsing direto via regex (sem offscreen round-trip)
          const eventos = parseEventosRegex(html);
          if (eventos.length > 0) {
            const classification = classifyByEventos(eventos);
            linkData.situacao = classification.situacao;
            if (classification.subtipoEvento) {
              linkData.subtipoEvento = classification.subtipoEvento;
            }
            linkData.eventos = eventos;
          }
          return true;

        } catch (error) {
          if (error.message === 'SESSION_EXPIRED') {
            throw error;
          }
          if (retry < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 500));
          } else {
            failedCount++;
            console.warn(`[Eventos] Falha para chave ${linkData.chave}: ${error.message}`);
          }
        }
      }
    }));

    // Verifica se algum do batch detectou sessão expirada
    for (const result of results) {
      if (result.status === 'rejected' && result.reason?.message === 'SESSION_EXPIRED') {
        sessionExpired = true;
        break;
      }
    }

    processed += batch.length;
    if (onProgress) {
      onProgress({
        phase: 'eventos',
        processed: processed,
        total: totalToCheck,
        percent: Math.round((processed / totalToCheck) * 100)
      });
    }

    // Sem delay entre batches — velocidade máxima
  }

  if (sessionExpired) {
    console.error('[Eventos] Sessão expirou durante classificação');
    throw new Error('SESSION_EXPIRED');
  }

  if (failedCount > 0) {
    console.warn(`[Eventos] ${failedCount} nota(s) não puderam ser verificadas (ficarão como "normal")`);
    if (onProgress) {
      onProgress({
        phase: 'eventos',
        processed: totalToCheck,
        total: totalToCheck,
        percent: 100,
        warning: `${failedCount} nota(s) não puderam ser verificadas e serão tratadas como normais.`
      });
    }
  }

  console.log('[Eventos] Classificação por eventos concluída');
  return links;
}

// ==========================================
// Extração de links das páginas do portal
// ==========================================

// Busca links de uma página específica via fetch
async function fetchPageLinks(pageNumber, dateStart, dateEnd, type, baseUrl, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1500;
  const TIMEOUT = 15000;

  try {
    const pageUrl = `${baseUrl}?pg=${pageNumber}&executar=1&busca=&datainicio=${dateStart}&datafim=${dateEnd}`;

    let response;
    if (isIncognitoContext) {
      // Em modo anônimo: timeout é gerenciado dentro do executeScript
      response = await portalFetch(pageUrl, { _timeout: TIMEOUT });
    } else {
      // Em modo normal: usa AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
      try {
        response = await portalFetch(pageUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'text/html' }
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!response.ok) {
      const errorMessages = {
        401: 'Sessão expirada. Faça login novamente no portal NFS-e.',
        403: 'Acesso negado. Verifique se você tem permissão para acessar este período.',
        429: 'O portal limitou as requisições. Aguarde alguns minutos e tente novamente.',
        500: 'O portal está com problemas internos. Tente novamente mais tarde.',
        502: 'O portal está temporariamente indisponível. Tente novamente mais tarde.',
        503: 'O portal está em manutenção. Tente novamente mais tarde.'
      };
      // Rate limit: marca como erro recuperável (não é sessão expirada)
      if (response.status === 429) {
        throw new Error('RATE_LIMITED:' + errorMessages[429]);
      }
      throw new Error(errorMessages[response.status] || `Erro HTTP ${response.status} ao acessar o portal.`);
    }

    const html = await response.text();

    if (!html || html.length < 100) {
      throw new Error('Resposta vazia ou inválida do servidor');
    }

    // Detecta sessão expirada
    const htmlLower = html.toLowerCase();
    const isLoginPage = (
      htmlLower.includes('sessão expirada') ||
      htmlLower.includes('sessao expirada') ||
      htmlLower.includes('realize o login') ||
      htmlLower.includes('faça login') ||
      (htmlLower.includes('action="/emissornacional/login"') || htmlLower.includes('action="/emissornacional/login/')) ||
      (htmlLower.includes('window.location') && htmlLower.includes('/login'))
    );
    const hasDataTable = htmlLower.includes('table-striped') || htmlLower.includes('td-competencia') || htmlLower.includes('download/nfse');
    if (isLoginPage && !hasDataTable) {
      throw new Error('SESSION_EXPIRED:Sua sessão expirou. Faça login novamente no portal NFS-e e tente novamente.');
    }

    console.log(`[Extract] Página ${pageNumber}: ${html.length} bytes`);

    // Envia HTML para o offscreen document para parsing DOM
    const parsed = await parseHtmlViaOffscreen(html, type);

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    return { links: parsed.links, hasNext: parsed.hasNext, pageNumber: pageNumber };
  } catch (error) {
    // Sessão expirada: propaga sem retry
    if (error.message && error.message.startsWith('SESSION_EXPIRED:')) {
      return { links: [], hasNext: false, pageNumber: pageNumber, error: error.message, sessionExpired: true };
    }

    const errorMessage = error.name === 'AbortError'
      ? 'Timeout ao acessar página'
      : (error.message || String(error));
    console.error(`[Extract] Erro página ${pageNumber}: ${errorMessage}`);

    // Rate limit: espera mais antes do retry
    const isRateLimited = error.message && error.message.startsWith('RATE_LIMITED:');
    const retryDelay = isRateLimited ? 5000 * (retryCount + 1) : RETRY_DELAY * (retryCount + 1);

    if (retryCount < MAX_RETRIES) {
      console.log(`[Extract] Retry ${retryCount + 1}/${MAX_RETRIES} (aguardando ${retryDelay}ms)...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchPageLinks(pageNumber, dateStart, dateEnd, type, baseUrl, retryCount + 1);
    }

    // IMPORTANTE: retorna hasNext como true para não parar o loop por erro de uma página
    return { links: [], hasNext: true, pageNumber: pageNumber, error: errorMessage, skipped: true };
  }
}

// Função principal: extrai links de todas as páginas com paginação paralela
async function extractLinks(dateStart, dateEnd, type, tipoNota, onProgress, buscarManifestacoes = false) {
  const cacheKey = getCacheKey(dateStart, dateEnd, type, tipoNota, buscarManifestacoes);
  if (isCacheValid(cacheKey)) {
    console.log('[Extract] Usando cache');
    if (onProgress) onProgress({ page: 'cache', found: extractCache.data.length, total: extractCache.data.length });
    // Retorna cópia profunda para evitar que fase 2 (eventos) contamine o cache
    return extractCache.data.map(link => ({ ...link }));
  }

  const baseUrl = tipoNota === 'Recebidas' ? PORTAL_URLS.recebidas : PORTAL_URLS.emitidas;

  let allLinks = [];
  let pageErrors = [];
  let skippedPages = [];
  let limitReached = false;

  // Primeira página
  const firstPageResult = await fetchPageLinks(1, dateStart, dateEnd, type, baseUrl);

  if (firstPageResult.sessionExpired) {
    if (onProgress) onProgress({ page: 1, found: 0, total: 0, error: firstPageResult.error.replace('SESSION_EXPIRED:', '') });
    throw new Error(firstPageResult.error.replace('SESSION_EXPIRED:', ''));
  }

  if (firstPageResult.error) {
    pageErrors.push({ page: 1, error: firstPageResult.error });
  }

  allLinks = allLinks.concat(firstPageResult.links);

  if (onProgress) onProgress({ page: 1, found: firstPageResult.links.length, total: allLinks.length });

  if (!firstPageResult.hasNext) {
    saveToCache(cacheKey, allLinks);
    return allLinks;
  }

  // Busca paralela: 3 páginas por vez
  let currentPage = 2;
  const PARALLEL_BATCH = 3;
  const MAX_PAGES = 2500;
  const MAX_EMPTY_BATCHES = 5; // Quantidade de lotes consecutivos sem dados antes de parar
  let hasMore = true;
  let emptyBatchCount = 0;

  while (hasMore) {
    const pagesToFetch = [];
    for (let i = 0; i < PARALLEL_BATCH; i++) {
      pagesToFetch.push(currentPage + i);
    }

    const results = await Promise.all(
      pagesToFetch.map(pageNum => fetchPageLinks(pageNum, dateStart, dateEnd, type, baseUrl))
    );

    let foundAnyLinks = false;
    let allSkippedInBatch = true;
    let paginationEnded = false;

    for (const result of results) {
      // Sessão expirada: para imediatamente
      if (result.sessionExpired) {
        if (onProgress) onProgress({ page: result.pageNumber, found: 0, total: allLinks.length, error: result.error.replace('SESSION_EXPIRED:', '') });
        throw new Error(result.error.replace('SESSION_EXPIRED:', ''));
      }

      // Página pulada por erro (após retries)
      if (result.skipped) {
        skippedPages.push(result.pageNumber);
        console.warn(`[Extract] Página ${result.pageNumber} pulada: ${result.error}`);
        continue;
      }

      allSkippedInBatch = false;

      if (result.error) {
        pageErrors.push({ page: result.pageNumber, error: result.error });
      }

      if (result.links.length > 0) {
        allLinks = allLinks.concat(result.links);
        foundAnyLinks = true;
        if (onProgress) onProgress({ page: result.pageNumber, found: result.links.length, total: allLinks.length });
      }

      // Só considera fim da paginação se veio do portal (não de erro)
      if (!result.hasNext && !result.skipped) {
        paginationEnded = true;
      }
    }

    // Controle de parada inteligente
    if (paginationEnded) {
      // Portal sinalizou fim da paginação em uma página real (não erro)
      hasMore = false;
    } else if (allSkippedInBatch) {
      // Todas as páginas do lote falharam - incrementa contador
      emptyBatchCount++;
      console.warn(`[Extract] Lote inteiro falhou (${emptyBatchCount}/${MAX_EMPTY_BATCHES})`);
      if (emptyBatchCount >= MAX_EMPTY_BATCHES) {
        console.error('[Extract] Muitos lotes consecutivos com falha, encerrando extração');
        hasMore = false;
      }
      // Pausa maior antes do próximo lote quando há falhas consecutivas
      await new Promise(resolve => setTimeout(resolve, 3000 * emptyBatchCount));
    } else if (!foundAnyLinks && !allSkippedInBatch) {
      // Páginas responderam OK mas sem links (pode ser fim real dos dados)
      emptyBatchCount++;
      if (emptyBatchCount >= MAX_EMPTY_BATCHES) {
        hasMore = false;
      }
    } else {
      // Reset contador quando encontra links
      emptyBatchCount = 0;
    }

    currentPage += PARALLEL_BATCH;

    if (currentPage > MAX_PAGES) {
      console.warn(`[Extract] Limite de ${MAX_PAGES} páginas atingido`);
      limitReached = true;
      hasMore = false;
    }
  }

  if (limitReached && onProgress) {
    onProgress({
      page: 'limit', found: 0, total: allLinks.length,
      warning: `Limite de ${MAX_PAGES.toLocaleString('pt-BR')} páginas atingido. Foram encontrados ${allLinks.length} arquivo(s), mas podem existir mais. Tente reduzir o período de busca.`
    });
  }

  if (skippedPages.length > 0) {
    console.warn(`[Extract] ${skippedPages.length} página(s) pulada(s): ${skippedPages.join(', ')}`);
    if (onProgress) {
      onProgress({
        page: 'skipped', found: 0, total: allLinks.length,
        warning: `${skippedPages.length} página(s) não puderam ser lidas (erros de rede). Aproximadamente ${skippedPages.length * 15} nota(s) podem não ter sido incluídas.`,
        skippedPages: skippedPages
      });
    }
  }

  if (pageErrors.length > 0 && onProgress) {
    onProgress({ page: 'errors', found: 0, total: allLinks.length, pageErrors: pageErrors });
  }

  saveToCache(cacheKey, allLinks);
  return allLinks;
}

// Extrai o nome da empresa do HTML do portal
async function getCompanyName() {
  try {
    const response = await portalFetch(PORTAL_URLS.dashboard);
    const html = await response.text();
    // Usa regex simples (funciona no service worker, não precisa de DOM)
    const match = html.match(/<li class="dropdown-header">\s*([^<]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  } catch (error) {
    console.error('[Extract] Erro ao buscar nome da empresa:', error);
    return null;
  }
}

// ==========================================
// POST para o portal (suporta normal e anônimo)
// ==========================================
async function portalPost(url, formData, timeoutMs = 15000) {
  const body = new URLSearchParams(formData).toString();

  if (isIncognitoContext) {
    const tabId = await getIncognitoPortalTabId();
    if (!tabId) throw new Error('Aba do portal não encontrada');

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (postUrl, postBody, timeout) => {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), timeout);
          const resp = await fetch(postUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postBody,
            signal: controller.signal
          });
          clearTimeout(tid);
          const text = await resp.text();
          return { ok: resp.ok, status: resp.status, url: resp.url, text };
        } catch (e) {
          return { ok: false, status: 0, text: '', error: e.name === 'AbortError' ? 'Timeout' : e.message };
        }
      },
      args: [url, body, timeoutMs]
    });

    const result = results?.[0]?.result;
    if (!result || result.error) throw new Error(result?.error || 'Sem resultado');
    return { ok: result.ok, status: result.status, text: async () => result.text };
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==========================================
// Confirmação em lote de Notas Recebidas
// ==========================================

// Abre o modal de manifestação para extrair o __RequestVerificationToken
async function fetchTokenFromModal(dataChave) {
  const url = PORTAL_ORIGIN + '/emissornacional/Notas/Recebidas/ModalManifestacao/';
  const response = await portalPost(url, {
    chave: dataChave,
    tipoManifestacao: '1'
  });

  const text = await response.text();

  // Detecta sessão expirada
  const textLower = text.toLowerCase();
  if (textLower.includes('/login') && !textLower.includes('requestverificationtoken')) {
    throw new Error('SESSION_EXPIRED');
  }

  // Extrai token do HTML do modal (pode estar em JSON ou HTML direto)
  const tokenMatch = text.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  if (tokenMatch) return tokenMatch[1];

  // Tenta extrair de JSON que contém HTML como string
  const tokenMatch2 = text.match(/__RequestVerificationToken[^"]*"[^"]*"([^"]+)"/);
  if (tokenMatch2) return tokenMatch2[1];

  // Tenta parse JSON e buscar token dentro
  try {
    const json = JSON.parse(text);
    const htmlContent = json.html || json.Html || json.content || json.Content || json.view || json.View || '';
    if (htmlContent) {
      const innerMatch = htmlContent.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
      if (innerMatch) return innerMatch[1];
    }
    // Token pode estar como propriedade direta
    if (json.requestVerificationToken || json.token || json.Token) {
      return json.requestVerificationToken || json.token || json.Token;
    }
  } catch (e) {
    // Não é JSON, já tentou regex acima
  }

  throw new Error('Token de verificação não encontrado no modal');
}

// Envia a confirmação (manifestação) de uma NFS-e
async function confirmarNota(token, chaveAcesso) {
  const url = PORTAL_ORIGIN + '/emissornacional/Notas/Recebidas/Manifestar';
  const response = await portalPost(url, {
    __RequestVerificationToken: token,
    TipoManifestacao: '1',
    TipoEvento: 'CONFIRMACAO_TOMADOR',
    ChaveAcesso: chaveAcesso
  });

  const text = await response.text();

  // Detecta sessão expirada
  const textLower = text.toLowerCase();
  if (textLower.includes('/login') && !textLower.includes('sucesso')) {
    throw new Error('SESSION_EXPIRED');
  }

  // Verifica resultado (pode ser JSON ou texto)
  try {
    const json = JSON.parse(text);
    // Sucesso
    if (json.sucesso === true || json.Sucesso === true || json.success === true) {
      return { success: true };
    }
    // Erro E0861 = já confirmada (não é falha real)
    const msg = json.mensagem || json.Mensagem || json.message || json.Message || '';
    if (msg.includes('E0861') || msg.includes('já está vinculado')) {
      return { success: true, alreadyConfirmed: true };
    }
    return { success: false, error: msg || 'Erro desconhecido' };
  } catch (e) {
    // Resposta não é JSON — analisa como texto
    if (textLower.includes('sucesso') || textLower.includes('realizada com sucesso')) {
      return { success: true };
    }
    if (text.includes('E0861') || textLower.includes('já está vinculado')) {
      return { success: true, alreadyConfirmed: true };
    }
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    return { success: false, error: text.substring(0, 200) };
  }
}

// Fluxo principal: busca notas recebidas sem eventos e confirma cada uma
async function confirmarNotasRecebidas(dateStart, dateEnd, onProgress) {
  const CONFIRM_DELAY = 800; // ms entre confirmações (evita rate limit)

  // Fase 1: Extrai links das páginas de Notas Recebidas
  onProgress({ phase: 'extraindo', message: 'Buscando notas recebidas...' });
  const links = await extractLinks(dateStart, dateEnd, 'xml', 'Recebidas', (progress) => {
    onProgress({ phase: 'extraindo', page: progress.page, found: progress.found, total: progress.total });
  });

  if (links.length === 0) {
    return { success: true, total: 0, confirmed: 0, skipped: 0, failed: 0, errors: [] };
  }

  // Filtra apenas notas que têm dataChave (necessário para manifestação)
  const linksComDataChave = links.filter(l => l.dataChave && l.chave);
  if (linksComDataChave.length === 0) {
    return { success: true, total: links.length, confirmed: 0, skipped: links.length, failed: 0, errors: [],
      message: 'Nenhuma nota possui dados para confirmação' };
  }

  // Fase 2: Verifica eventos de cada nota (identifica quais já têm manifestação)
  onProgress({ phase: 'eventos', message: 'Verificando eventos das notas...', processed: 0, total: linksComDataChave.length });
  await fetchEventosForLinks(linksComDataChave, (progress) => {
    onProgress({ phase: 'eventos', processed: progress.processed, total: progress.total, percent: progress.percent });
  }, true); // modoManifestacoes=true para verificar TODAS

  // Fase 3: Filtra notas sem eventos (candidatas a confirmação)
  const notasParaConfirmar = linksComDataChave.filter(l => !l.eventos || l.eventos.length === 0);

  if (notasParaConfirmar.length === 0) {
    return { success: true, total: linksComDataChave.length, confirmed: 0, skipped: linksComDataChave.length, failed: 0, errors: [],
      message: 'Todas as notas já possuem eventos/manifestação' };
  }

  onProgress({
    phase: 'confirmar',
    message: `Encontradas ${notasParaConfirmar.length} nota(s) para confirmar`,
    processed: 0,
    total: notasParaConfirmar.length
  });

  // Fase 4: Confirma cada nota
  let confirmed = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < notasParaConfirmar.length; i++) {
    const nota = notasParaConfirmar[i];

    try {
      // Passo 1: Busca token do modal
      const token = await fetchTokenFromModal(nota.dataChave);

      // Passo 2: Confirma a nota
      const result = await confirmarNota(token, nota.chave);

      if (result.success) {
        if (result.alreadyConfirmed) {
          skipped++;
        } else {
          confirmed++;
        }
      } else {
        failed++;
        errors.push({ chave: nota.chave, cnpjCpf: nota.cnpjCpf, nome: nota.nome, error: result.error });
      }
    } catch (error) {
      if (error.message === 'SESSION_EXPIRED') {
        // Sessão expirou: retorna resultado parcial
        return {
          success: false,
          total: notasParaConfirmar.length,
          confirmed,
          skipped,
          failed: failed + (notasParaConfirmar.length - i - 1),
          errors,
          sessionExpired: true,
          message: 'Sessão expirou durante a confirmação. Faça login e tente novamente.'
        };
      }
      failed++;
      errors.push({ chave: nota.chave, cnpjCpf: nota.cnpjCpf, nome: nota.nome, error: error.message });
    }

    onProgress({
      phase: 'confirmar',
      processed: i + 1,
      total: notasParaConfirmar.length,
      percent: Math.round(((i + 1) / notasParaConfirmar.length) * 100),
      confirmed,
      skipped,
      failed
    });

    // Delay entre confirmações para evitar rate limiting
    if (i < notasParaConfirmar.length - 1) {
      await new Promise(r => setTimeout(r, CONFIRM_DELAY));
    }
  }

  return {
    success: true,
    total: notasParaConfirmar.length,
    confirmed,
    skipped,
    failed,
    errors,
    totalNotas: linksComDataChave.length
  };
}

// Busca notas recebidas sem eventos (Fases 1-3) para seleção do usuário
async function listarNotasParaConfirmar(dateStart, dateEnd, onProgress) {
  // Fase 1: Extrai links das páginas de Notas Recebidas
  onProgress({ phase: 'extraindo', message: 'Buscando notas recebidas...' });
  const links = await extractLinks(dateStart, dateEnd, 'xml', 'Recebidas', (progress) => {
    onProgress({ phase: 'extraindo', page: progress.page, found: progress.found, total: progress.total });
  });

  if (links.length === 0) {
    return { success: true, notas: [], total: 0, message: 'Nenhuma nota encontrada no período.' };
  }

  // Filtra apenas notas que têm dataChave (necessário para manifestação)
  const linksComDataChave = links.filter(l => l.dataChave && l.chave);
  if (linksComDataChave.length === 0) {
    return { success: true, notas: [], total: links.length, message: 'Nenhuma nota possui dados para confirmação' };
  }

  // Fase 2: Verifica eventos de cada nota
  onProgress({ phase: 'eventos', message: 'Verificando eventos das notas...', processed: 0, total: linksComDataChave.length });
  await fetchEventosForLinks(linksComDataChave, (progress) => {
    onProgress({ phase: 'eventos', processed: progress.processed, total: progress.total, percent: progress.percent });
  }, true);

  // Fase 3: Filtra notas sem eventos
  const notasSemEvento = linksComDataChave.filter(l => !l.eventos || l.eventos.length === 0);

  // Extrai nNFSe de cada nota
  const notas = notasSemEvento.map(l => ({
    chave: l.chave,
    dataChave: l.dataChave,
    nNFSe: extractNNFSe(l.chave) || '-',
    cnpjCpf: l.cnpjCpf || '-',
    nome: l.nome || '-',
    competencia: l.competencia || '-',
    valor: l.valor || '-',
    geracao: l.geracao || '-'
  }));

  if (notas.length === 0) {
    const totalComEvento = linksComDataChave.length;
    const msg = totalComEvento === 1
      ? 'A única nota encontrada já possui evento. Nenhuma para confirmar.'
      : `Todas as ${totalComEvento} notas já possuem evento. Nenhuma para confirmar.`;
    return { success: true, notas: [], total: totalComEvento, message: msg };
  }

  return { success: true, notas, total: linksComDataChave.length };
}

// Confirma apenas as notas selecionadas pelo usuário (Fase 4)
async function confirmarNotasSelecionadas(notas, onProgress) {
  const CONFIRM_DELAY = 800;
  let confirmed = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < notas.length; i++) {
    const nota = notas[i];

    try {
      const token = await fetchTokenFromModal(nota.dataChave);
      const result = await confirmarNota(token, nota.chave);

      if (result.success) {
        if (result.alreadyConfirmed) {
          skipped++;
        } else {
          confirmed++;
        }
      } else {
        failed++;
        errors.push({ chave: nota.chave, cnpjCpf: nota.cnpjCpf, nome: nota.nome, error: result.error });
      }
    } catch (error) {
      if (error.message === 'SESSION_EXPIRED') {
        return {
          success: false,
          total: notas.length,
          confirmed,
          skipped,
          failed: failed + (notas.length - i - 1),
          errors,
          sessionExpired: true,
          message: 'Sessão expirou durante a confirmação. Faça login e tente novamente.'
        };
      }
      failed++;
      errors.push({ chave: nota.chave, cnpjCpf: nota.cnpjCpf, nome: nota.nome, error: error.message });
    }

    onProgress({
      phase: 'confirmar',
      processed: i + 1,
      total: notas.length,
      percent: Math.round(((i + 1) / notas.length) * 100),
      confirmed,
      skipped,
      failed
    });

    if (i < notas.length - 1) {
      await new Promise(r => setTimeout(r, CONFIRM_DELAY));
    }
  }

  return { success: true, total: notas.length, confirmed, skipped, failed, errors };
}

// Controle de pausa/retomada para sessão expirada
let downloadPaused = false;
let resumeResolve = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Detecta se a mensagem veio de um contexto anônimo
  if (message.incognito !== undefined) {
    isIncognitoContext = !!message.incognito;
  }

  // ==========================================
  // Verificação de sessão
  // ==========================================
  if (message.action === 'checkSession') {
    checkSession().then(loggedIn => {
      sendResponse({ loggedIn });
    });
    return true;
  }

  // ==========================================
  // Buscar nome da empresa (para exibir no popup)
  // ==========================================
  if (message.action === 'getCompanyName') {
    (async () => {
      const loggedIn = await checkSession();
      if (!loggedIn) {
        sendResponse({ loggedIn: false, companyName: null });
        return;
      }
      const companyName = await getCompanyName();
      sendResponse({ loggedIn: true, companyName });
    })();
    return true;
  }

  // ==========================================
  // Navegar aba ativa para página do portal
  // ==========================================
  if (message.action === 'navigateToPortal') {
    const url = message.tipoNota === 'Recebidas' ? PORTAL_URLS.recebidas : PORTAL_URLS.emitidas;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await chrome.tabs.update(tab.id, { url });
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Navigate] Erro ao navegar:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ==========================================
  // Extração de links (movido do content.js)
  // ==========================================
  if (message.action === 'extractLinks') {
    startKeepAlive();
    startSessionKeepAlive();
    extractLinks(message.dateStart, message.dateEnd, message.type, message.tipoNota, (progress) => {
      chrome.runtime.sendMessage({
        action: 'extractProgress',
        progress: progress
      }).catch(() => {});
    }, !!message.buscarManifestacoes).then(async links => {
      // Fase 2: Busca eventos SOMENTE se o usuário marcou "Buscar manifestações"
      if (links.length > 0 && message.buscarManifestacoes) {
        chrome.runtime.sendMessage({
          action: 'extractProgress',
          progress: { phase: 'eventos', processed: 0, total: links.length, percent: 0 }
        }).catch(() => {});

        try {
          await fetchEventosForLinks(links, (progress) => {
            chrome.runtime.sendMessage({
              action: 'extractProgress',
              progress: progress
            }).catch(() => {});
          }, message.buscarManifestacoes);
        } catch (error) {
          // Qualquer erro (incluindo SESSION_EXPIRED): retorna links com classificação parcial
          // Os links já verificados até o erro terão situacao atualizada, os demais ficam como 'normal'
          console.warn('[Extract] Erro ao buscar eventos (usando classificação parcial):', error.message);
        }
      }

      const companyName = await getCompanyName();
      stopKeepAlive();
      sendResponse({ links, companyName });
    }).catch(error => {
      stopKeepAlive();
      sendResponse({ links: [], error: error.message });
    });
    return true;
  }

  // ==========================================
  // Downloads
  // ==========================================
  if (message.action === 'startDownloads') {
    downloadPaused = false;
    resumeResolve = null;
    if (message.customFolderMode !== undefined) customFolderMode = !!message.customFolderMode;
    processDownloads(message.links, message.folderName, message.type, message.modoManifestacoes, message.renameToNNFSe || false, message.competenciaYYYYMM || null, message.loteExpectedCounts || null)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        stopKeepAlive();
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indica que a resposta será assíncrona
  }

  // Popup pede para retomar downloads após relogin
  if (message.action === 'resumeDownloads') {
    if (message.customFolderMode !== undefined) customFolderMode = !!message.customFolderMode;
    downloadPaused = false;
    if (resumeResolve) {
      resumeResolve();
      resumeResolve = null;
    }
    sendResponse({ ok: true });
    return true;
  }

  // Popup informa o modo de pasta customizada
  if (message.action === 'setCustomFolderMode') {
    customFolderMode = !!message.enabled;
    sendResponse({ ok: true });
    return;
  }

  // ==========================================
  // Confirmação em lote de Notas Recebidas
  // ==========================================
  if (message.action === 'confirmarNotas') {
    startKeepAlive();
    startSessionKeepAlive();
    confirmarNotasRecebidas(message.dateStart, message.dateEnd, (progress) => {
      chrome.runtime.sendMessage({
        action: 'confirmarProgress',
        progress: progress
      }).catch(() => {});
    }).then(result => {
      stopKeepAlive();
      sendResponse(result);
    }).catch(error => {
      stopKeepAlive();
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Listar notas para confirmação (Fases 1-3)
  if (message.action === 'listarNotasParaConfirmar') {
    startKeepAlive();
    startSessionKeepAlive();
    listarNotasParaConfirmar(message.dateStart, message.dateEnd, (progress) => {
      chrome.runtime.sendMessage({
        action: 'confirmarProgress',
        progress: progress
      }).catch(() => {});
    }).then(result => {
      stopKeepAlive();
      sendResponse(result);
    }).catch(error => {
      stopKeepAlive();
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Confirmar notas selecionadas (Fase 4)
  if (message.action === 'confirmarNotasSelecionadas') {
    startKeepAlive();
    startSessionKeepAlive();
    confirmarNotasSelecionadas(message.notas, (progress) => {
      chrome.runtime.sendMessage({
        action: 'confirmarProgress',
        progress: progress
      }).catch(() => {});
    }).then(result => {
      stopKeepAlive();
      sendResponse(result);
    }).catch(error => {
      stopKeepAlive();
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

});

// Envia progresso de download para o popup/sidepanel
function sendDownloadProgress(downloaded, total, errors, currentFile) {
  chrome.runtime.sendMessage({
    action: 'downloadProgress',
    progress: {
      downloaded: downloaded,
      total: total,
      errors: errors,
      currentFile: currentFile,
      percent: total > 0 ? Math.round((downloaded / total) * 100) : 0
    }
  }).catch(() => {
    // Popup/sidepanel pode estar fechado, ignora
  });
}

// Extrai nNFSe (número da nota) a partir da chave de 50+ dígitos
// Posições 23-35 contêm o número sequencial da NFS-e
function extractNNFSe(chave) {
  const clean = chave.replace(/\.\w+$/, '');
  if (clean.length >= 36) {
    const n = parseInt(clean.substring(23, 36), 10);
    if (!isNaN(n) && n > 0) return String(n);
  }
  return null;
}



// Sanitiza nome de arquivo extraído da URL (decodifica %xx, remove caracteres inválidos)
function sanitizeFileName(name) {
  try { name = decodeURIComponent(name); } catch (e) { /* mantém original se decode falhar */ }
  return (name || 'nota')
    .replace(/[<>:"\/\\|?*]/g, '-')
    .replace(/[\x00-\x1F]/g, '')
    .replace(/\.+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || 'nota';
}

// Verifica se o XML corresponde ao mês de competência
// Usa regex (service worker não tem DOMParser)
function matchesCompetencia(xmlContent, competenciaYYYYMM) {
  if (!competenciaYYYYMM) return true;
  const match = xmlContent.match(/<dCompet>(\d{4}-\d{2})/);
  return match ? match[1] === competenciaYYYYMM : false;
}

async function processDownloads(links, folderName, type, modoManifestacoes = false, renameToNNFSe = false, competenciaYYYYMM = null, loteExpectedCounts = null) {
  // Mantém o service worker vivo durante todo o processo
  startKeepAlive();


  let totalFiles = 0;
  let downloadedFiles = 0;
  let errors = [];
  let failedFiles = []; // Lista detalhada de arquivos que falharam

  // Filtro por competência: verifica dCompet de cada nota antes de baixar
  if (competenciaYYYYMM) {
    const filteredLinks = [];
    let checked = 0;

    for (const linkData of links) {
      checked++;
      let matched = false;

      if (linkData.xmlUrl) {
        try {
          let xmlText = '';
          if (isIncognitoContext) {
            const tabId = await getIncognitoPortalTabId();
            if (tabId) {
              const fetchResult = await fetchFileViaTab(tabId, linkData.xmlUrl);
              if (!fetchResult.error && fetchResult.dataUrl) {
                // Decodifica base64 data URL para texto
                const base64Part = fetchResult.dataUrl.split(',')[1];
                const binaryStr = atob(base64Part);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                xmlText = new TextDecoder('utf-8').decode(bytes);
              }
            }
          } else {
            const resp = await portalFetch(linkData.xmlUrl);
            if (resp.ok) {
              xmlText = await resp.text();
            }
          }
          matched = matchesCompetencia(xmlText, competenciaYYYYMM);
        } catch (e) {
          matched = true; // Em caso de erro, inclui a nota
        }
      } else {
        matched = true; // Sem URL XML, inclui
      }

      if (matched) {
        filteredLinks.push(linkData);
      }

      // Envia progresso da verificação de competência
      chrome.runtime.sendMessage({
        action: 'competenciaProgress',
        checked: checked,
        total: links.length,
        matched: filteredLinks.length,
        skipped: checked - filteredLinks.length
      }).catch(() => {});
    }

    links = filteredLinks;

    if (links.length === 0) {
      stopKeepAlive();
      return { success: true, downloadedFiles: 0, totalFiles: 0, failedFiles: [], competenciaFiltered: true };
    }
  }

  // Calcula total de arquivos
  links.forEach(link => {
    if ((type === 'xml' || type === 'both') && link.xmlUrl) totalFiles++;
    if ((type === 'pdf' || type === 'both') && link.pdfUrl) totalFiles++;
  });

  // Função para aguardar um download completar (ou falhar)
  function waitForDownloadComplete(downloadId, timeoutMs = 60000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkStatus = () => {
        chrome.downloads.search({ id: downloadId }, (results) => {
          if (!results || results.length === 0) {
            resolve({ success: false, error: 'Download não encontrado' });
            return;
          }

          const download = results[0];

          if (download.state === 'complete') {
            resolve({ success: true });
          } else if (download.state === 'interrupted') {
            resolve({ success: false, error: download.error || 'Interrompido' });
          } else if (Date.now() - startTime > timeoutMs) {
            resolve({ success: false, error: 'Timeout' });
          } else {
            // Ainda em progresso, verifica novamente em 100ms
            setTimeout(checkStatus, 100);
          }
        });
      };

      checkStatus();
    });
  }

  // Função para gerar pasta de fallback mantendo a estrutura de data/período
  // folderName: "NFSe/Nome da Empresa/01-01-2026 a 31-01-2026 Emitidas"
  // fallback:   "NFSe/NOME DA EMPRESA FALHOU/01-01-2026 a 31-01-2026 Emitidas"
  function getFallbackFolder(originalFolder) {
    const parts = originalFolder.split('/');
    // parts[0] = "NFSe", parts[1] = "Nome da Empresa", parts[2] = "01-01-2026 a 31-01-2026 Emitidas"
    if (parts.length >= 3) {
      return `NFSe/NOME DA EMPRESA FALHOU/${parts.slice(2).join('/')}`;
    }
    return 'NFSe/NOME DA EMPRESA FALHOU';
  }

  // Função para fazer download de um arquivo com retry automático
  async function downloadFile(url, folderName, fileName, delayMs = 0, retryCount = 0, waitComplete = false, useFallback = false) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre tentativas
    const pastaAtual = useFallback ? getFallbackFolder(folderName) : folderName;

    // Modo pasta customizada: busca conteúdo e envia para popup escrever via File System Access
    if (customFolderMode) {
      await new Promise(r => setTimeout(r, delayMs));
      try {
        let arrayBuffer;
        if (isIncognitoContext) {
          const tabId = await getIncognitoPortalTabId();
          if (!tabId) throw new Error('Aba do portal não encontrada');
          const fetchResult = await fetchFileViaTab(tabId, url);
          if (fetchResult.error) throw new Error(fetchResult.error);
          const resp = await fetch(fetchResult.dataUrl);
          arrayBuffer = await resp.arrayBuffer();
        } else {
          const resp = await portalFetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          arrayBuffer = await resp.arrayBuffer();
        }
        const filePath = `${pastaAtual}/${fileName}`;
        const response = await chrome.runtime.sendMessage({
          action: 'writeFileToCustomFolder',
          filePath: filePath,
          dataBase64: arrayBufferToBase64(arrayBuffer)
        });
        if (response && !response.success) {
          throw new Error(response.error || 'Falha ao escrever na pasta customizada');
        }
        downloadedFiles++;
        sendDownloadProgress(downloadedFiles, totalFiles, errors, fileName);
        return;
      } catch (err) {
        // Fallback: se a pasta customizada falhar (ex: janela anônima), tenta via chrome.downloads
        console.warn(`Pasta customizada falhou para ${fileName}, tentando fallback via chrome.downloads:`, err.message);
        customFolderMode = false; // Desabilita para os próximos arquivos também
        // Continua para o fluxo normal abaixo (isIncognitoContext ou download direto)
      }
    }

    // Em modo anônimo: busca conteúdo via executeScript na aba do portal e salva com data URL
    if (isIncognitoContext) {
      await new Promise(r => setTimeout(r, delayMs));
      const tabId = await getIncognitoPortalTabId();
      if (!tabId) throw new Error('Aba do portal não encontrada');

      const fetchResult = await fetchFileViaTab(tabId, url);
      if (fetchResult.error) {
        if (retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          return downloadFile(url, folderName, fileName, 0, retryCount + 1, waitComplete, useFallback);
        }
        const friendlyError = translateDownloadError(fetchResult.error);
        errors.push(`Erro ao baixar ${fileName}: ${friendlyError}`);
        failedFiles.push({ fileName, url, error: friendlyError, retries: retryCount });
        throw new Error(friendlyError);
      }

      return new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: fetchResult.dataUrl,
          filename: `${pastaAtual}/${fileName}`,
          saveAs: false
        }, async (downloadId) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            if (!useFallback && (errorMsg.includes('filename') || errorMsg.includes('path') || errorMsg.includes('invalid'))) {
              try {
                const result = await downloadFile(url, folderName, fileName, 0, 0, waitComplete, true);
                resolve(result);
              } catch (err) {
                errors.push(`Erro ao baixar ${fileName}: ${errorMsg}`);
                reject(err);
              }
              return;
            }
            const friendlyError = translateDownloadError(errorMsg);
            errors.push(`Erro ao baixar ${fileName}: ${friendlyError}`);
            failedFiles.push({ fileName, url, error: friendlyError, retries: retryCount });
            reject(chrome.runtime.lastError);
          } else {
            if (waitComplete) {
              const result = await waitForDownloadComplete(downloadId);
              if (!result.success) {
                if (retryCount < MAX_RETRIES) {
                  await new Promise(r => setTimeout(r, RETRY_DELAY));
                  try { resolve(await downloadFile(url, folderName, fileName, 0, retryCount + 1, waitComplete, useFallback)); } catch (err) { reject(err); }
                  return;
                }
                const friendlyError = translateDownloadError(result.error);
                failedFiles.push({ fileName, url, error: friendlyError, retries: retryCount });
                reject(new Error(friendlyError));
                return;
              }
            }
            downloadedFiles++;
            resolve(downloadId);
          }
        });
      });
    }

    // Modo normal: download direto via URL
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        chrome.downloads.download({
          url: url,
          filename: `${pastaAtual}/${fileName}`,
          saveAs: false
        }, async (downloadId) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;

            // Se o erro for relacionado ao nome da pasta e ainda não usou fallback, tenta com pasta genérica
            if (!useFallback && (
              errorMsg.includes('filename') ||
              errorMsg.includes('path') ||
              errorMsg.includes('invalid')
            )) {
              console.log(`Erro no nome da pasta, tentando com pasta genérica: ${fileName}`);
              try {
                const result = await downloadFile(url, folderName, fileName, 0, 0, waitComplete, true);
                resolve(result);
              } catch (err) {
                errors.push(`Erro ao baixar ${fileName}: ${errorMsg}`);
                reject(err);
              }
              return;
            }

            // Se o erro for de rede/conexão e ainda temos tentativas, tenta novamente
            const errorLower = errorMsg.toLowerCase();
            if (retryCount < MAX_RETRIES && (
              errorLower.includes('network') ||
              errorLower.includes('timeout') ||
              errorLower.includes('connection') ||
              errorLower.includes('failed') ||
              errorLower.includes('interrupted') ||
              errorLower.includes('err_') ||
              errorLower.includes('dns') ||
              errorLower.includes('ssl') ||
              errorLower.includes('certificate')
            )) {
              console.log(`Tentando novamente download de ${fileName}... (tentativa ${retryCount + 1}/${MAX_RETRIES})`);
              await new Promise(r => setTimeout(r, RETRY_DELAY));

              try {
                const result = await downloadFile(url, folderName, fileName, 0, retryCount + 1, waitComplete, useFallback);
                resolve(result);
              } catch (err) {
                const friendlyError = translateDownloadError(errorMsg);
                errors.push(`Erro ao baixar ${fileName}: ${friendlyError}`);
                failedFiles.push({ fileName, url, error: friendlyError, retries: retryCount + 1 });
                reject(err);
              }
            } else {
              const friendlyError = translateDownloadError(errorMsg);
              errors.push(`Erro ao baixar ${fileName}: ${friendlyError}`);
              failedFiles.push({ fileName, url, error: friendlyError, retries: retryCount });
              reject(chrome.runtime.lastError);
            }
          } else {
            // Se waitComplete está ativo, aguarda o download finalizar antes de contar
            if (waitComplete) {
              const result = await waitForDownloadComplete(downloadId);
              if (!result.success) {
                if (retryCount < MAX_RETRIES) {
                  console.log(`Download falhou (${result.error}), tentando novamente ${fileName}...`);
                  await new Promise(r => setTimeout(r, RETRY_DELAY));
                  try {
                    const retryResult = await downloadFile(url, folderName, fileName, 0, retryCount + 1, waitComplete);
                    resolve(retryResult);
                  } catch (err) {
                    reject(err);
                  }
                  return;
                }
                // Esgotou retries: conta como falha
                const friendlyError = translateDownloadError(result.error);
                failedFiles.push({ fileName, url, error: friendlyError, retries: retryCount });
                reject(new Error(friendlyError));
                return;
              }
            }

            // Só incrementa após confirmação de que o download foi aceito/completado
            downloadedFiles++;
            resolve(downloadId);
          }
        });
      }, delayMs);
    });
  }

  // Remove acentos e caracteres especiais de nomes de pasta
  function sanitizeSubfolder(name) {
    return name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[<>:"/\\|?*]/g, '')                     // Remove caracteres inválidos no Windows
      .replace(/\s{2,}/g, ' ')                          // Remove espaços duplos
      .trim();
  }

  // Monta subpasta baseada na situação da NFS-e
  // Mesma lógica para ambos os modos: Cancelada/, Substituida/, ou raiz
  function getSubfolder(linkData) {
    switch (linkData.situacao) {
      case 'substituida': return 'Substituida';
      case 'cancelada': return 'Cancelada';
      case 'manifestacao': {
        // Usa o subtipo do evento como subpasta: "Rejeição do Tomador" → "Rejeicao do Tomador"
        const subtipo = linkData.subtipoEvento || '';
        return subtipo ? sanitizeSubfolder(subtipo) : '';
      }
      default: return ''; // Normal fica na raiz
    }
  }

  // Prepara lista de downloads
  const downloadTasks = [];
  const isRecebidas = folderName.includes('Recebidas');

  for (const linkData of links) {
    const subfolder = getSubfolder(linkData);
    // Prefixo LOTE N (X notas)/ se linkData tiver loteNum e houver mapa de contagens
    let lotePrefix = '';
    if (linkData.loteNum && loteExpectedCounts && loteExpectedCounts[linkData.loteNum]) {
      lotePrefix = `LOTE ${linkData.loteNum} (${loteExpectedCounts[linkData.loteNum]} notas)/`;
    }
    const subPath = lotePrefix + (subfolder ? `${subfolder}/` : '');

    // Download XML se existir e for solicitado
    if ((type === 'xml' || type === 'both') && linkData.xmlUrl) {
      const urlParts = linkData.xmlUrl.split('/');
      const notaId = sanitizeFileName(urlParts[urlParts.length - 1]);
      const nNFSe = renameToNNFSe ? extractNNFSe(notaId) : null;
      const cnpj = (renameToNNFSe && isRecebidas && nNFSe && linkData.cnpjCpf) ? linkData.cnpjCpf.replace(/[.\-\/]/g, '') : null;
      const baseName = nNFSe ? (cnpj ? `${cnpj}_${nNFSe}` : nNFSe) : notaId;
      downloadTasks.push({
        url: linkData.xmlUrl,
        fileName: `${subPath}${baseName}.xml`,
        delay: 30 // Delay fixo de 30ms para cada download (otimizado)
      });
    }

    // Download PDF se existir e for solicitado
    if ((type === 'pdf' || type === 'both') && linkData.pdfUrl) {
      const urlParts = linkData.pdfUrl.split('/');
      const notaId = sanitizeFileName(urlParts[urlParts.length - 1]);
      const nNFSe = renameToNNFSe ? extractNNFSe(notaId) : null;
      const cnpj = (renameToNNFSe && isRecebidas && nNFSe && linkData.cnpjCpf) ? linkData.cnpjCpf.replace(/[.\-\/]/g, '') : null;
      const baseName = nNFSe ? (cnpj ? `${cnpj}_${nNFSe}` : nNFSe) : notaId;
      downloadTasks.push({
        url: linkData.pdfUrl,
        fileName: `${subPath}${baseName}.pdf`,
        delay: 30 // Delay fixo de 30ms para cada download (otimizado)
      });
    }
  }

  // Rate limiting inteligente: ajusta tamanho do lote baseado no total de arquivos
  let BATCH_SIZE = 8;
  let BATCH_DELAY = 50; // Delay entre lotes em ms
  let WAIT_COMPLETE = false; // Se true, aguarda cada download completar antes de iniciar próximo lote

  if (downloadTasks.length > 5000) {
    BATCH_SIZE = 2; // Volumes enormes (>5000): muito conservador para não travar o Chrome
    BATCH_DELAY = 500;
    WAIT_COMPLETE = true;
  } else if (downloadTasks.length > 1000) {
    BATCH_SIZE = 3; // Volumes grandes (1000-5000): conservador
    BATCH_DELAY = 400;
    WAIT_COMPLETE = true;
  } else if (downloadTasks.length > 500) {
    BATCH_SIZE = 3; // Volumes médio-grandes (500-1000)
    BATCH_DELAY = 300;
    WAIT_COMPLETE = true;
  } else if (downloadTasks.length > 100) {
    BATCH_SIZE = 4; // Volumes médios (100-500)
    BATCH_DELAY = 150;
    WAIT_COMPLETE = true;
  } else if (downloadTasks.length < 20) {
    BATCH_SIZE = 10; // Lotes pequenos: mais agressivo
  }

  // Envia progresso inicial
  sendDownloadProgress(0, downloadTasks.length, 0, '');

  console.log(`Processando ${downloadTasks.length} arquivo(s) em lotes de ${BATCH_SIZE} (aguardar conclusão: ${WAIT_COMPLETE})`);

  const batches = [];
  for (let i = 0; i < downloadTasks.length; i += BATCH_SIZE) {
    batches.push(downloadTasks.slice(i, i + BATCH_SIZE));
  }

  // Detecção de sessão expirada: conta erros consecutivos
  let consecutiveErrors = 0;
  const SESSION_ERROR_THRESHOLD = 5; // 5 erros seguidos = provável sessão expirada

  // Processa cada lote
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let batchErrors = 0;

    if (isIncognitoContext) {
      // === MODO ANÔNIMO: busca lote inteiro em um único executeScript ===
      const tabId = await getIncognitoPortalTabId();
      if (!tabId) {
        console.error('[Download] Aba do portal não encontrada');
        break;
      }

      const batchUrls = batch.map(t => t.url);
      const fetchResults = await fetchFilesBatchViaTab(tabId, batchUrls);

      // Mapeia resultados por URL para acesso rápido
      const resultMap = {};
      for (const r of fetchResults) {
        resultMap[r.url] = r;
      }

      // Salva cada arquivo do lote
      for (const task of batch) {
        const fetchResult = resultMap[task.url];
        if (!fetchResult || fetchResult.error) {
          const friendlyError = translateDownloadError(fetchResult?.error || 'Erro desconhecido');
          errors.push(`Erro ao baixar ${task.fileName}: ${friendlyError}`);
          failedFiles.push({ fileName: task.fileName, url: task.url, error: friendlyError, retries: 0 });
          batchErrors++;
          continue;
        }

        // Salva o data URL via chrome.downloads
        try {
          await new Promise((resolve, reject) => {
            const pastaAtual = folderName;
            chrome.downloads.download({
              url: fetchResult.dataUrl,
              filename: `${pastaAtual}/${task.fileName}`,
              saveAs: false
            }, async (downloadId) => {
              if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message;
                // Tenta fallback de pasta se erro de nome
                if (errorMsg.includes('filename') || errorMsg.includes('path') || errorMsg.includes('invalid')) {
                  const fallbackFolder = getFallbackFolder(folderName);
                  chrome.downloads.download({
                    url: fetchResult.dataUrl,
                    filename: `${fallbackFolder}/${task.fileName}`,
                    saveAs: false
                  }, (retryId) => {
                    if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                    } else {
                      downloadedFiles++;
                      resolve(retryId);
                    }
                  });
                } else {
                  reject(new Error(errorMsg));
                }
              } else {
                if (WAIT_COMPLETE) {
                  const result = await waitForDownloadComplete(downloadId);
                  if (!result.success) {
                    reject(new Error(result.error));
                    return;
                  }
                }
                downloadedFiles++;
                resolve(downloadId);
              }
            });
          });
          consecutiveErrors = 0;
        } catch (err) {
          const friendlyError = translateDownloadError(err.message);
          errors.push(`Erro ao baixar ${task.fileName}: ${friendlyError}`);
          failedFiles.push({ fileName: task.fileName, url: task.url, error: friendlyError, retries: 0 });
          batchErrors++;
        }
      }
    } else {
      // === MODO NORMAL: download direto em paralelo (comportamento original) ===
      const batchPromises = batch.map(task =>
        downloadFile(task.url, folderName, task.fileName, task.delay, 0, WAIT_COMPLETE)
          .then(() => {
            consecutiveErrors = 0;
          })
          .catch(error => {
            console.error(`Erro ao baixar ${task.fileName}:`, error);
            batchErrors++;
          })
      );

      await Promise.allSettled(batchPromises);
    }

    // Verifica se todo o lote falhou (provável sessão expirada)
    if (batchErrors === batch.length) {
      consecutiveErrors += batchErrors;
    } else {
      consecutiveErrors = 0;
    }

    // Se muitos erros consecutivos, pausa e avisa o popup
    if (consecutiveErrors >= SESSION_ERROR_THRESHOLD) {
      console.warn(`[Download] ${consecutiveErrors} erros consecutivos detectados. Possível sessão expirada.`);

      downloadPaused = true;
      const remainingBatches = batches.length - i - 1;
      const remainingFiles = remainingBatches * BATCH_SIZE;

      // Avisa o popup
      chrome.runtime.sendMessage({
        action: 'downloadSessionExpired',
        progress: {
          downloaded: downloadedFiles,
          total: downloadTasks.length,
          errors: failedFiles.length,
          remaining: remainingFiles
        }
      }).catch(() => {});

      // Aguarda o popup mandar retomar
      await new Promise((resolve) => {
        resumeResolve = resolve;
      });

      // Reseta contador de erros após retomada
      consecutiveErrors = 0;
      console.log('[Download] Retomado pelo usuário após relogin');

    }

    // Envia progresso a cada lote
    const processed = Math.min((i + 1) * BATCH_SIZE, downloadTasks.length);
    sendDownloadProgress(downloadedFiles, downloadTasks.length, failedFiles.length, batch[0]?.fileName || '');

    // Log de progresso a cada 100 lotes
    if ((i + 1) % 100 === 0 || i === batches.length - 1) {
      console.log(`[Download] Progresso: ${processed}/${downloadTasks.length} (${Math.round(processed / downloadTasks.length * 100)}%)`);
    }

    // Delay adicional entre lotes para não sobrecarregar
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  // Para o keep-alive ao finalizar
  stopKeepAlive();

  // Envia progresso final
  sendDownloadProgress(downloadedFiles, downloadTasks.length, failedFiles.length, '');

  return {
    success: true,
    totalFiles: totalFiles,
    downloadedFiles: downloadedFiles,
    errors: errors,
    failedFiles: failedFiles
  };
}

// Traduz erros de download para mensagens amigáveis em português
function translateDownloadError(errorMsg) {
  const msg = errorMsg.toLowerCase();
  if (msg.includes('network')) return 'Erro de rede. Verifique sua conexão.';
  if (msg.includes('timeout')) return 'Tempo esgotado. O portal demorou para responder.';
  if (msg.includes('connection')) return 'Falha na conexão com o portal.';
  if (msg.includes('filename') || msg.includes('path') || msg.includes('invalid'))
    return 'Nome de arquivo inválido para o Windows.';
  if (msg.includes('disk') || msg.includes('space')) return 'Espaço em disco insuficiente.';
  if (msg.includes('permission') || msg.includes('access')) return 'Sem permissão para salvar o arquivo.';
  if (msg.includes('interrupted')) return 'Download interrompido.';
  return errorMsg;
}

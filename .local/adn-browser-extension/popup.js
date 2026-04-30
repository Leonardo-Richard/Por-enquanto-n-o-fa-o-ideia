// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// Script do popup para controlar a interface e downloads

document.addEventListener('DOMContentLoaded', function () {
  // Configuração interna de validação do módulo
  const _nfseModCfg = { _b: 20180119, _s: 2948, _r: 'Q0VDSE5GU2U=' };

  // Detecta se está em janela anônima para informar o background
  let _isIncognito = false;
  let _incognitoReady = new Promise((resolve) => {
    chrome.windows.getCurrent((win) => {
      _isIncognito = !!win.incognito;
      if (_isIncognito) console.log('[Popup] Executando em modo anônimo');
      resolve();
    });
  });

  // Wrapper para enviar mensagens ao background com flag de incognito
  function sendBgMessage(msg, callback) {
    chrome.runtime.sendMessage({ ...msg, incognito: _isIncognito }, callback);
  }

  // =============== IndexedDB para FileSystemDirectoryHandle ===============
  const IDB_NAME = 'BaixarNFSeDB';
  const IDB_STORE = 'directoryHandles';
  const IDB_KEY = 'customFolder';

  function openIDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveDirectoryHandle(handle) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadDirectoryHandle() {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearDirectoryHandle() {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // =============== File System Access - Escrita em pasta customizada ===============
  let _customDirHandle = null;
  let _customFolderEnabled = false;

  async function getSubdirectory(parentHandle, relativePath) {
    const parts = relativePath.split('/').filter(p => p.length > 0);
    let current = parentHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }

  async function writeFileToCustomFolder(content, relativePath) {
    if (!_customDirHandle) throw new Error('Pasta personalizada não configurada');

    const lastSlash = relativePath.lastIndexOf('/');
    const dirPath = lastSlash > 0 ? relativePath.substring(0, lastSlash) : '';
    const fileName = lastSlash > 0 ? relativePath.substring(lastSlash + 1) : relativePath;

    let targetDir = _customDirHandle;
    if (dirPath) targetDir = await getSubdirectory(_customDirHandle, dirPath);

    const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    if (content instanceof Blob) {
      await writable.write(content);
    } else if (content instanceof ArrayBuffer) {
      await writable.write(new Uint8Array(content));
    } else {
      await writable.write(content);
    }
    await writable.close();
  }

  function isCustomFolderActive() {
    return _customFolderEnabled && _customDirHandle !== null;
  }

  async function downloadBlobSmart(blob, relativePath) {
    if (isCustomFolderActive()) {
      // Pasta personalizada: salva direto sem subpastas (só o nome do arquivo)
      const fileName = relativePath.includes('/') ? relativePath.substring(relativePath.lastIndexOf('/') + 1) : relativePath;
      await writeFileToCustomFolder(blob, fileName);
      return null;
    }
    const blobUrl = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: blobUrl,
        filename: relativePath,
        saveAs: false
      }, (id) => {
        if (chrome.runtime.lastError) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          const checkComplete = () => {
            chrome.downloads.search({ id }, (results) => {
              if (!results || results.length === 0) { URL.revokeObjectURL(blobUrl); resolve(id); return; }
              const dl = results[0];
              if (dl.state === 'complete' || dl.state === 'interrupted') {
                URL.revokeObjectURL(blobUrl);
                resolve(id);
              } else {
                setTimeout(checkComplete, 500);
              }
            });
          };
          checkComplete();
        }
      });
    });
  }

  // Busca o ID da aba anônima do portal NFSe
  async function _getIncognitoPortalTabId() {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://www.nfse.gov.br/*' });
      const incognitoTab = tabs.find(t => t.incognito);
      return incognitoTab ? incognitoTab.id : (tabs[0] ? tabs[0].id : null);
    } catch (e) { return null; }
  }

  // Busca o windowId correto para abrir novas abas (anônima ou normal)
  async function _getTargetWindowId() {
    if (_isIncognito) {
      // No modo spanning, o side panel pode rodar no contexto normal.
      // Busca a janela anônima pela aba do portal.
      try {
        const tabs = await chrome.tabs.query({ url: 'https://www.nfse.gov.br/*' });
        const incognitoTab = tabs.find(t => t.incognito);
        if (incognitoTab) return incognitoTab.windowId;
        // Fallback: busca qualquer janela anônima
        const allWindows = await chrome.windows.getAll();
        const incognitoWin = allWindows.find(w => w.incognito);
        if (incognitoWin) return incognitoWin.id;
      } catch (e) { /* fallback abaixo */ }
    }
    const currentWindow = await chrome.windows.getCurrent();
    return currentWindow.id;
  }

  // Fetch que funciona em contexto normal e anônimo
  // Em modo anônimo, executa o fetch dentro da aba do portal via chrome.scripting.executeScript
  async function portalFetch(url, options = {}) {
    if (_isIncognito) {
      const tabId = await _getIncognitoPortalTabId();
      if (!tabId) throw new Error('Aba do portal NFS-e não encontrada.');
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (fetchUrl) => {
          try {
            const resp = await fetch(fetchUrl, { credentials: 'include', redirect: 'follow' });
            const text = await resp.text();
            return { ok: resp.ok, status: resp.status, url: resp.url, text };
          } catch (e) {
            return { ok: false, status: 0, url: fetchUrl, text: '', error: e.message };
          }
        },
        args: [url]
      });
      const result = results?.[0]?.result;
      if (!result || result.error) throw new Error(result?.error || 'Erro ao buscar dados do portal.');
      return { ok: result.ok, status: result.status, url: result.url, text: async () => result.text };
    }
    return fetch(url, { credentials: 'include', ...options });
  }

  // Exibe versão da extensão no rodapé
  const versionEl = document.getElementById('extVersion');
  if (versionEl) {
    const ver = chrome.runtime.getManifest().version;
    versionEl.textContent = `v${ver}`;
  }

  // FAQ
  const btnFaq = document.getElementById('btnFaq');
  if (btnFaq) {
    btnFaq.addEventListener('click', async (e) => {
      e.preventDefault();
      const windowId = await _getTargetWindowId();
      chrome.tabs.create({ url: chrome.runtime.getURL('faq.html'), windowId });
    });
  }

  // Link "Acessar" do passo 1: navega a aba ativa para o portal (funciona em anônima)
  const linkAcessar = document.getElementById('linkAcessarPortal');
  if (linkAcessar) {
    linkAcessar.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.update(tabs[0].id, { url: 'https://www.nfse.gov.br/EmissorNacional/Dashboard' });
        }
      });
    });
  }

  // Menu Compartilhar
  const SHARE_URL = 'https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea';
  const SHARE_TEXT = 'Baixar NFSe - Extensão para download de XML e PDF de Notas Fiscais de Serviço';
  const btnCompartilhar = document.getElementById('btnCompartilhar');
  const shareMenu = document.getElementById('shareMenu');

  if (btnCompartilhar && shareMenu) {
    btnCompartilhar.addEventListener('click', (e) => {
      e.preventDefault();
      shareMenu.style.display = shareMenu.style.display === 'none' ? 'block' : 'none';
    });

    // Fecha menu ao clicar fora
    document.addEventListener('click', (e) => {
      if (!shareMenu.contains(e.target) && !btnCompartilhar.contains(e.target)) {
        shareMenu.style.display = 'none';
      }
    });

    // Copiar link
    document.getElementById('shareCopy').addEventListener('click', () => {
      navigator.clipboard.writeText(SHARE_URL).then(() => {
        const btn = document.getElementById('shareCopy');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size: 9px; color: #25D366; font-weight: 500;">Copiado!</span>';
        btn.style.background = '#f0faf0';
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.style.background = '#f5f5f5';
          shareMenu.style.display = 'none';
        }, 1800);
      });
    });

    // WhatsApp
    document.getElementById('shareWhatsApp').addEventListener('click', () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + '\n' + SHARE_URL)}`, '_blank');
      shareMenu.style.display = 'none';
    });

    // E-mail
    document.getElementById('shareEmail').addEventListener('click', () => {
      window.open(`mailto:?subject=${encodeURIComponent(SHARE_TEXT)}&body=${encodeURIComponent(SHARE_TEXT + '\n\n' + SHARE_URL)}`, '_blank');
      shareMenu.style.display = 'none';
    });

    // Hover nos botões do menu
    shareMenu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.background = '#ebebeb'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#f5f5f5'; });
    });
  }



  // Aplica tema visual do banner
  const banner = document.querySelector('.certificate-banner');
  if (banner) banner.classList.add('morning');

  // Limpa tipo de NFS-e ao abrir o painel (usuário deve escolher)
  document.body.removeAttribute('data-nfse-type');
  document.querySelectorAll('.nfse-type-btn').forEach(b => b.classList.remove('selected'));

  // Restaura formato de download salvo
  chrome.storage.local.get('downloadType', (result) => {
    if (result.downloadType) {
      const radio = document.querySelector(`input[name="downloadType"][value="${result.downloadType}"]`);
      if (radio) radio.checked = true;
    }
  });

  // Salva formato de download ao mudar
  document.querySelectorAll('input[name="downloadType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      chrome.storage.local.set({ downloadType: radio.value });
    });
  });

  // Restaura preferência de renomear para nNFSe
  chrome.storage.local.get('renameToNNFSe', (result) => {
    const chk = document.getElementById('chkRenameToNNFSe');
    if (chk && result.renameToNNFSe) chk.checked = true;
  });

  // Salva preferência de renomear ao mudar
  const chkRename = document.getElementById('chkRenameToNNFSe');
  if (chkRename) {
    chkRename.addEventListener('change', () => {
      chrome.storage.local.set({ renameToNNFSe: chkRename.checked });
    });
  }

  // Restaura preferência de .zip
  chrome.storage.local.get('downloadAsZip', (result) => {
    const chk = document.getElementById('chkZip');
    if (chk && result.downloadAsZip) chk.checked = true;
  });

  // Salva preferência de .zip ao mudar
  const chkZipEl = document.getElementById('chkZip');
  if (chkZipEl) {
    chkZipEl.addEventListener('change', () => {
      chrome.storage.local.set({ downloadAsZip: chkZipEl.checked });
    });
  }

  // Restaura preferência de tamanho do lote (importante para retry consistente)
  chrome.storage.local.get('loteSize', (result) => {
    const sel = document.getElementById('selectLoteSize');
    if (sel && result.loteSize) {
      const n = parseInt(result.loteSize, 10);
      if (!isNaN(n) && n > 0) sel.value = String(n);
    }
  });
  const selectLoteSizeEl = document.getElementById('selectLoteSize');
  if (selectLoteSizeEl) {
    selectLoteSizeEl.addEventListener('change', () => {
      const n = parseInt(selectLoteSizeEl.value, 10);
      if (!isNaN(n) && n > 0) {
        chrome.storage.local.set({ loteSize: String(n) });
      }
    });
  }

  // Restaura preferência do Filtrar (select)
  chrome.storage.local.get('filtroMode', (result) => {
    const selFiltro = document.getElementById('selectFiltroNotas');
    if (selFiltro && result.filtroMode) {
      const allowed = ['', 'eventos', 'cs', 'exceto', 'faixa'];
      if (allowed.includes(result.filtroMode)) {
        selFiltro.value = result.filtroMode;
        // Dispara change para atualizar estilo e mostrar sub-inputs
        selFiltro.dispatchEvent(new Event('change'));
      }
    }
  });
  const _selectFiltro = document.getElementById('selectFiltroNotas');
  if (_selectFiltro) {
    _selectFiltro.addEventListener('change', () => {
      chrome.storage.local.set({ filtroMode: _selectFiltro.value });
    });
  }

  // Restaura preferência do checkbox "Organizar em lotes"
  chrome.storage.local.get('loteAtivo', (result) => {
    const chkL = document.getElementById('chkLote');
    if (chkL && result.loteAtivo === true) {
      chkL.checked = true;
      // Dispara change para mostrar sub-opções e validar
      chkL.dispatchEvent(new Event('change'));
    }
  });
  const _chkLote = document.getElementById('chkLote');
  if (_chkLote) {
    _chkLote.addEventListener('change', () => {
      chrome.storage.local.set({ loteAtivo: _chkLote.checked });
    });
  }

  // Restaura estado aberto/recolhido do "Mais opções"
  chrome.storage.local.get('maisOpcoesOpen', (result) => {
    if (result.maisOpcoesOpen === true) {
      const btn = document.getElementById('btnMaisOpcoes');
      const section = document.getElementById('maisOpcoesSection');
      if (btn && section && section.style.display === 'none') {
        btn.click();
      }
    }
  });
  const _btnMaisOp = document.getElementById('btnMaisOpcoes');
  if (_btnMaisOp) {
    _btnMaisOp.addEventListener('click', () => {
      // Após o click handler original processar, salva o novo estado
      setTimeout(() => {
        const section = document.getElementById('maisOpcoesSection');
        if (section) {
          chrome.storage.local.set({ maisOpcoesOpen: section.style.display !== 'none' });
        }
      }, 0);
    });
  }

  // =============== Competência - Inicialização ===============
  function populateCompetenciaMonths() {
    const select = document.getElementById('selectCompetencia');
    if (!select) return;
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                         'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // Lê o período de geração (Data Inicial / Data Final)
    const startVal = document.getElementById('dateStart')?.value; // "2026-02-01"
    const endVal = document.getElementById('dateEnd')?.value;     // "2026-03-31"

    const previousValue = select.value; // Preserva seleção atual se possível
    select.innerHTML = '';

    if (!startVal || !endVal) return;

    // Usa apenas a data inicial para gerar os meses de competência
    const [sY, sM] = startVal.split('-').map(Number);
    const dStart = new Date(sY, sM - 1, 1);

    // Gera: 2 meses antes + 1 mês antes (padrão) + mês da data inicial
    const dPrev2 = new Date(dStart);
    dPrev2.setMonth(dPrev2.getMonth() - 2);
    const dPrevMonth = new Date(dStart);
    dPrevMonth.setMonth(dPrevMonth.getMonth() - 1);
    const prevMonthValue = `${dPrevMonth.getFullYear()}-${String(dPrevMonth.getMonth() + 1).padStart(2, '0')}`;

    const meses = [dPrev2, dPrevMonth, dStart];
    for (const d of meses) {
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-based
      const value = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${monthNames[month]}/${year}`;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }

    if (select.options.length === 0) return;

    // Tenta restaurar seleção anterior ou mês salvo
    const restoreValue = (val) => {
      const exists = Array.from(select.options).some(o => o.value === val);
      if (exists) { select.value = val; return true; }
      return false;
    };

    // Prioridade: valor anterior > mês salvo > mês anterior ao período (padrão)
    if (!restoreValue(previousValue)) {
      chrome.storage.local.get('competenciaMonth', (result) => {
        if (!result.competenciaMonth || !restoreValue(result.competenciaMonth)) {
          restoreValue(prevMonthValue) || (select.selectedIndex = 0);
        }
      });
    }
  }

  function toggleCompetenciaSection() {
    const chk = document.getElementById('chkCompetencia');
    const select = document.getElementById('selectCompetencia');
    if (!chk || !select) return;
    if (chk.checked) {
      select.style.display = '';
      populateCompetenciaMonths();
    } else {
      select.style.display = 'none';
    }
  }

  // Restaura preferência de competência e mostra seção
  chrome.storage.local.get('competencia', (result) => {
    const chk = document.getElementById('chkCompetencia');
    if (chk && result.competencia) chk.checked = true;
    // Mostra a seção (checkbox sempre visível)
    const section = document.getElementById('competenciaSection');
    if (section) section.style.display = 'flex';
    toggleCompetenciaSection();
  });

  // Salva preferência de competência ao mudar
  const chkCompetencia = document.getElementById('chkCompetencia');
  if (chkCompetencia) {
    chkCompetencia.addEventListener('change', () => {
      chrome.storage.local.set({ competencia: chkCompetencia.checked });
      toggleCompetenciaSection();
    });
  }

  // Salva mês selecionado ao mudar
  const selectCompetencia = document.getElementById('selectCompetencia');
  if (selectCompetencia) {
    selectCompetencia.addEventListener('change', () => {
      chrome.storage.local.set({ competenciaMonth: selectCompetencia.value });
    });
  }

  // Filtro de notas: ajusta estilo quando um filtro está ativo + mostra inputs de faixa
  const selectFiltroNotas = document.getElementById('selectFiltroNotas');
  if (selectFiltroNotas) {
    const applyFilterStyle = () => {
      if (selectFiltroNotas.value) {
        selectFiltroNotas.style.color = '#1a1a1a';
        selectFiltroNotas.style.fontStyle = 'normal';
      } else {
        selectFiltroNotas.style.color = '#999';
        selectFiltroNotas.style.fontStyle = 'italic';
      }
      const filtroNumRow = document.getElementById('filtroNumerosRow');
      if (filtroNumRow) {
        filtroNumRow.style.display = selectFiltroNotas.value === 'faixa' ? 'flex' : 'none';
      }
    };
    selectFiltroNotas.addEventListener('change', applyFilterStyle);
    applyFilterStyle();
  }

  // Helper: retorna o modo de filtro atual ('eventos' | 'cs' | 'exceto' | '')
  function getFiltroMode() {
    return document.getElementById('selectFiltroNotas')?.value || '';
  }

  // Toggle "Mais opções": mostra/esconde a seção e aplica borda do fieldset só quando aberta
  const btnMaisOpcoes = document.getElementById('btnMaisOpcoes');
  const maisOpcoesSection = document.getElementById('maisOpcoesSection');
  const maisOpcoesFieldset = document.getElementById('maisOpcoesFieldset');
  if (btnMaisOpcoes && maisOpcoesSection) {
    btnMaisOpcoes.addEventListener('click', () => {
      const aberto = maisOpcoesSection.style.display !== 'none';
      maisOpcoesSection.style.display = aberto ? 'none' : 'flex';
      const arrow = document.getElementById('btnMaisOpcoesArrow');
      const label = document.getElementById('btnMaisOpcoesLabel');
      if (arrow) arrow.textContent = aberto ? '▾' : '▴';
      if (label) label.textContent = aberto ? 'Mais opções' : 'Menos opções';
      // Alterna borda/padding do fieldset: só aparece quando expandido
      if (maisOpcoesFieldset) {
        if (aberto) {
          maisOpcoesFieldset.style.border = 'none';
          maisOpcoesFieldset.style.padding = '0';
        } else {
          maisOpcoesFieldset.style.border = '1px solid #ccd0d5';
          maisOpcoesFieldset.style.borderRadius = '8px';
          maisOpcoesFieldset.style.padding = '0 12px 4px';
        }
      }
    });
  }

  // Helper: retorna faixa de números do filtro (nIni, nFim) ou null se não aplicável
  function getFiltroNumeros() {
    const iniStr = document.getElementById('inputNumIni')?.value?.trim() || '';
    const fimStr = document.getElementById('inputNumFim')?.value?.trim() || '';
    if (!iniStr && !fimStr) return null;
    const ini = iniStr ? parseInt(iniStr, 10) : null;
    const fim = fimStr ? parseInt(fimStr, 10) : null;
    if (ini !== null && isNaN(ini)) return null;
    if (fim !== null && isNaN(fim)) return null;
    return { ini, fim };
  }

  // Lote: toggle sub-opções e habilitar/desabilitar inputs conforme radio
  const chkLote = document.getElementById('chkLote');
  const loteSubRow = document.getElementById('loteSubRow');
  const radiosLoteRange = document.querySelectorAll('input[name="loteRange"]');
  const loteIniInput = document.getElementById('loteIni');
  const loteFimInput = document.getElementById('loteFim');
  function applyLoteUI() {
    const ativo = chkLote?.checked || false;
    if (loteSubRow) loteSubRow.style.display = ativo ? 'flex' : 'none';
    const somente = [...radiosLoteRange].some(r => r.checked && r.value === 'some');
    const wrapper = document.getElementById('loteInputsWrapper');
    if (wrapper) wrapper.style.display = (ativo && somente) ? 'inline-flex' : 'none';
  }
  if (chkLote) chkLote.addEventListener('change', applyLoteUI);
  radiosLoteRange.forEach(r => r.addEventListener('change', applyLoteUI));
  applyLoteUI();

  // Helper: retorna config do lote ou null se desativado
  // { size: 500, mode: 'all' | 'some', ini: 3, fim: 3 }
  function getLoteConfig() {
    const chk = document.getElementById('chkLote');
    if (!chk || !chk.checked) return null;
    const size = parseInt(document.getElementById('selectLoteSize')?.value || '500', 10);
    const modeRadio = [...document.querySelectorAll('input[name="loteRange"]')].find(r => r.checked);
    const mode = modeRadio ? modeRadio.value : 'all';
    const iniStr = document.getElementById('loteIni')?.value?.trim() || '';
    const fimStr = document.getElementById('loteFim')?.value?.trim() || '';
    const ini = iniStr ? parseInt(iniStr, 10) : null;
    const fim = fimStr ? parseInt(fimStr, 10) : null;
    return { size, mode, ini, fim };
  }

  // Validação visual do tamanho do lote: obrigatório quando chkLote marcado
  function validarTamanhoLote() {
    const chk = document.getElementById('chkLote');
    const inp = document.getElementById('selectLoteSize');
    if (!chk || !inp) return true;
    if (!chk.checked) { inp.style.borderColor = '#e5e5e5'; inp.title = ''; return true; }
    const n = parseInt(inp.value, 10);
    const invalido = !inp.value.trim() || isNaN(n) || n < 1;
    inp.style.borderColor = invalido ? '#dc2626' : '#e5e5e5';
    inp.title = invalido ? 'Informe um tamanho válido para o lote (ex: 500)' : '';
    return !invalido;
  }
  const chkLoteVal = document.getElementById('chkLote');
  const inpLoteSize = document.getElementById('selectLoteSize');
  if (chkLoteVal) chkLoteVal.addEventListener('change', validarTamanhoLote);
  if (inpLoteSize) inpLoteSize.addEventListener('input', validarTamanhoLote);

  // Validação visual: nº final deve ser >= nº inicial quando ambos preenchidos
  function validarFaixaNumeros() {
    const inpIni = document.getElementById('inputNumIni');
    const inpFim = document.getElementById('inputNumFim');
    if (!inpIni || !inpFim) return true;
    const ini = inpIni.value.trim() ? parseInt(inpIni.value, 10) : null;
    const fim = inpFim.value.trim() ? parseInt(inpFim.value, 10) : null;
    const invalido = ini !== null && fim !== null && !isNaN(ini) && !isNaN(fim) && fim < ini;
    inpFim.style.borderColor = invalido ? '#dc2626' : '#e5e5e5';
    inpFim.title = invalido ? 'O nº final deve ser maior ou igual ao nº inicial' : '';
    return !invalido;
  }
  // Validação direta apenas no campo "fim" — o "ini" valida via handler próprio depois do auto-replicate
  const _inpFimN = document.getElementById('inputNumFim');
  if (_inpFimN) _inpFimN.addEventListener('input', validarFaixaNumeros);

  // Validação visual: nº do lote final deve ser >= nº do lote inicial quando ambos preenchidos
  function validarFaixaLotes() {
    const inpIni = document.getElementById('loteIni');
    const inpFim = document.getElementById('loteFim');
    if (!inpIni || !inpFim) return true;
    const ini = inpIni.value.trim() ? parseInt(inpIni.value, 10) : null;
    const fim = inpFim.value.trim() ? parseInt(inpFim.value, 10) : null;
    const invalido = ini !== null && fim !== null && !isNaN(ini) && !isNaN(fim) && fim < ini;
    inpFim.style.borderColor = invalido ? '#dc2626' : '#e5e5e5';
    inpFim.title = invalido ? 'O lote final deve ser maior ou igual ao lote inicial' : '';
    return !invalido;
  }
  // Validação direta apenas no campo "fim" — o "ini" valida via handler próprio depois do auto-replicate
  const _inpFimL = document.getElementById('loteFim');
  if (_inpFimL) _inpFimL.addEventListener('input', validarFaixaLotes);
  // Auto-replica: ao digitar nº inicial, copia no final até o usuário tomar controle do final
  const inpNumIniEl = document.getElementById('inputNumIni');
  const inpNumFimEl = document.getElementById('inputNumFim');
  if (inpNumIniEl && inpNumFimEl) {
    let fimNumAuto = !inpNumFimEl.value.trim();
    inpNumIniEl.addEventListener('input', () => {
      if (fimNumAuto && inpNumIniEl.value.trim()) {
        inpNumFimEl.value = inpNumIniEl.value;
      }
      // Revalida após possível copy (limpa estado vermelho do tick anterior)
      validarFaixaNumeros();
    });
    inpNumFimEl.addEventListener('input', () => {
      fimNumAuto = !inpNumFimEl.value.trim();
    });
  }
  // Auto-replica: ao digitar lote inicial, copia no final até o usuário tomar controle do final
  const loteIniEl = document.getElementById('loteIni');
  const loteFimEl = document.getElementById('loteFim');
  if (loteIniEl && loteFimEl) {
    let fimLoteAuto = !loteFimEl.value.trim();
    loteIniEl.addEventListener('input', () => {
      if (fimLoteAuto && loteIniEl.value.trim()) {
        loteFimEl.value = loteIniEl.value;
      }
      // Revalida após possível copy (limpa estado vermelho do tick anterior)
      validarFaixaLotes();
    });
    loteFimEl.addEventListener('input', () => {
      fimLoteAuto = !loteFimEl.value.trim();
    });
  }

  // =============== Escolher Pasta - Inicialização ===============
  // Mostra a opção apenas se o browser suporta File System Access API
  // Em janela anônima, showDirectoryPicker existe mas lança SecurityError ao ser chamada
  // Usa _incognitoReady (Promise) pois a detecção via chrome.windows.getCurrent é assíncrona
  _incognitoReady.then(() => {
    if (typeof window.showDirectoryPicker === 'function' && !_isIncognito) {
      const lblEscolherPasta = document.getElementById('lblEscolherPasta');
      if (lblEscolherPasta) lblEscolherPasta.style.display = 'inline-flex';
    } else if (_isIncognito) {
      // Mostra label "Pasta" desabilitada com mensagem visível em janela anônima
      const lblEscolherPasta = document.getElementById('lblEscolherPasta');
      if (lblEscolherPasta) {
        lblEscolherPasta.style.display = 'inline-flex';
        lblEscolherPasta.style.cursor = 'default';
        lblEscolherPasta.style.color = '#9ca3af';
        lblEscolherPasta.style.textDecoration = 'line-through';
        lblEscolherPasta.title = 'Não disponível em janela anônima';
        const chkInside = lblEscolherPasta.querySelector('input');
        if (chkInside) { chkInside.disabled = true; chkInside.style.cursor = 'default'; }
      }
    }
  });

  function updateFolderDisplay(folderName, authorized) {
    const pathEl = document.getElementById('selectedFolderPath');
    const warningEl = document.getElementById('folderPermissionWarning');
    if (folderName) {
      if (pathEl) {
        pathEl.textContent = '\uD83D\uDCC1 ' + folderName;
        pathEl.style.color = authorized ? '#16a34a' : '#92400e';
      }
      if (warningEl) warningEl.style.display = 'none';
    } else {
      if (pathEl) { pathEl.textContent = 'Nenhuma pasta selecionada'; pathEl.style.color = '#999'; }
      if (warningEl) warningEl.style.display = 'none';
    }
  }

  async function restoreDirectoryHandle() {
    try {
      const handle = await loadDirectoryHandle();
      if (!handle) { updateFolderDisplay(null, false); return; }
      _customDirHandle = handle;
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        updateFolderDisplay(handle.name, true);
      } else {
        updateFolderDisplay(handle.name, false);
      }
    } catch (err) {
      console.error('Erro ao restaurar pasta:', err);
      updateFolderDisplay(null, false);
    }
  }

  // Restaura preferência "Escolher Pasta"
  // Em janela anônima, File System Access API não funciona - força desabilitado
  chrome.storage.local.get('escolherPasta', async (result) => {
    await _incognitoReady;
    const chk = document.getElementById('chkEscolherPasta');
    const section = document.getElementById('folderPickerSection');
    if (_isIncognito) {
      if (chk) chk.checked = false;
      _customFolderEnabled = false;
      sendBgMessage({ action: 'setCustomFolderMode', enabled: false });
      return;
    }
    if (chk && result.escolherPasta) {
      chk.checked = true;
      _customFolderEnabled = true;
      if (section) section.style.display = 'inline-flex';
      await restoreDirectoryHandle();
      sendBgMessage({ action: 'setCustomFolderMode', enabled: true });
    } else {
      sendBgMessage({ action: 'setCustomFolderMode', enabled: false });
    }
  });

  // Toggle checkbox "Escolher Pasta"
  const chkEscolherPasta = document.getElementById('chkEscolherPasta');
  if (chkEscolherPasta) {
    chkEscolherPasta.addEventListener('change', async () => {
      _customFolderEnabled = chkEscolherPasta.checked;
      chrome.storage.local.set({ escolherPasta: chkEscolherPasta.checked });
      const section = document.getElementById('folderPickerSection');
      if (section) section.style.display = chkEscolherPasta.checked ? 'inline-flex' : 'none';
      if (chkEscolherPasta.checked && !_customDirHandle) {
        await restoreDirectoryHandle();
      }
      sendBgMessage({ action: 'setCustomFolderMode', enabled: chkEscolherPasta.checked });
    });
  }

  // Botão "Selecionar" pasta
  const btnEscolherPasta = document.getElementById('btnEscolherPasta');
  if (btnEscolherPasta) {
    btnEscolherPasta.addEventListener('click', async () => {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        _customDirHandle = handle;
        await saveDirectoryHandle(handle);
        updateFolderDisplay(handle.name, true);
      } catch (err) {
        if (err.name === 'AbortError') return;
        // SecurityError ocorre em janela anônima onde File System Access API é bloqueada
        if (err.name === 'SecurityError' || err.name === 'NotAllowedError') {
          showStatus('⚠️ Seleção de pasta não é suportada em janela anônima. Os arquivos serão baixados na pasta padrão de downloads.', 'error');
          // Desabilita o modo pasta customizada
          const chk = document.getElementById('chkEscolherPasta');
          if (chk) chk.checked = false;
          _customFolderEnabled = false;
          const section = document.getElementById('folderPickerSection');
          if (section) section.style.display = 'none';
          sendBgMessage({ action: 'setCustomFolderMode', enabled: false });
        } else {
          console.error('Erro ao selecionar pasta:', err);
        }
      }
    });
  }

  // Link "Reautorizar"
  async function reauthorizeFolder() {
    if (_customDirHandle) {
      try {
        const perm = await _customDirHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          // Verifica se a pasta ainda existe no disco
          try {
            for await (const _ of _customDirHandle.values()) { break; }
            updateFolderDisplay(_customDirHandle.name, true);
            showStatus('✅ Pasta reautorizada com sucesso!', 'success');
          } catch {
            showStatus('⚠️ A pasta "' + _customDirHandle.name + '" não existe mais. Selecione uma nova pasta.', 'error');
            updateFolderDisplay(_customDirHandle.name, false);
          }
        }
      } catch (err) {
        console.error('Erro ao reautorizar:', err);
      }
    }
  }

  const btnReauthorize = document.getElementById('btnReauthorize');
  if (btnReauthorize) {
    btnReauthorize.addEventListener('click', async (e) => {
      e.preventDefault();
      await reauthorizeFolder();
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

  // Busca nome da empresa ao carregar o painel
  function loadCompanyName() {
    sendBgMessage({ action: 'getCompanyName' }, (response) => {
      if (chrome.runtime.lastError) return;
      const badge = document.getElementById('companyBadge');
      const nameEl = document.getElementById('companyName');
      if (!badge || !nameEl) return;

      if (response && response.loggedIn) {
        nameEl.textContent = response.companyName || 'Empresa conectada';
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    });
  }

  // Carrega ao abrir o painel (aguarda detecção de incognito antes)
  _incognitoReady.then(() => loadCompanyName());

  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const startDownloadBtn = document.getElementById('startDownloadBtn');
  const chkConfirmar = document.getElementById('chkConfirmar');
  const lblConfirmar = document.getElementById('lblConfirmar');
  const reportBtn = document.getElementById('reportBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  const status = document.getElementById('status');

  // Função auxiliar para obter primeiro e último dia do mês
  function getMonthDates(monthsAgo = 0) {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Nomes completos dos meses
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // Nomes abreviados para os links
    const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Formato YYYY-MM-DD para input type="date"
    return {
      start: `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`,
      end: `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`,
      label: `${monthNames[month]}/${year}`,
      labelShort: `${monthNamesShort[month]}/${year}`
    };
  }

  // Função auxiliar para formatar data como YYYY-MM-DD
  function toISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // ==========================================
  // Atalhos de data (select)
  // ==========================================
  function buildDateShortcuts() {
    const container = document.getElementById('dateShortcuts');
    if (!container) return [];

    const now = new Date();
    const currentMonth = getMonthDates(0);
    const previousMonth = getMonthDates(1);

    const today = toISO(now);
    const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterday = toISO(yesterdayDate);

    // Formato DD/MM para exibição nos dias
    const todayDDMM = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0');
    const yesterdayDDMM = String(yesterdayDate.getDate()).padStart(2, '0') + '/' + String(yesterdayDate.getMonth() + 1).padStart(2, '0');

    const prevMonthFull = previousMonth.label.split('/')[0];
    const currMonthFull = currentMonth.label.split('/')[0];

    const shortcuts = [
      { group: 'Dias', items: [
        { id: 'yesterday', label: 'Ontem', start: yesterday, end: yesterday },
        { id: 'today', label: 'Hoje', start: today, end: today },
        { id: 'yesterdayToday', label: 'Ontem e Hoje', start: yesterday, end: today },
      ]},
      { group: 'Meses', items: [
        { id: 'prevMonth', label: 'Mês Anterior', start: previousMonth.start, end: previousMonth.end },
        { id: 'currMonth', label: 'Mês Atual', start: currentMonth.start, end: currentMonth.end },
        { id: 'bothMonths', label: 'Mês Anterior e Atual', start: previousMonth.start, end: currentMonth.end },
      ]},
    ];

    container.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'date-shortcuts-label';
    label.textContent = 'Período rápido:';
    container.appendChild(label);
    const select = document.createElement('select');
    select.id = 'dateShortcutSelect';

    // Opção padrão (quando o usuário edita as datas manualmente)
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Personalizado';
    defaultOption.dataset.start = '';
    defaultOption.dataset.end = '';
    select.appendChild(defaultOption);

    shortcuts.forEach(group => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.group;
      group.items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        option.dataset.start = item.start;
        option.dataset.end = item.end;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });

    select.addEventListener('change', () => {
      const selected = select.options[select.selectedIndex];
      if (selected && selected.dataset.start) {
        dateStart.value = selected.dataset.start;
        dateEnd.value = selected.dataset.end;
        chrome.storage.local.set({ dateShortcut: selected.value });
      } else {
        // "Personalizado" selecionado — limpa atalho salvo, mantém datas
        chrome.storage.local.remove('dateShortcut');
      }
      populateCompetenciaMonths();
    });

    container.appendChild(select);

    // Retorna flat list para compatibilidade
    return shortcuts.flatMap(g => g.items);
  }

  const dateShortcutsList = buildDateShortcuts();

  // Função para converter data YYYY-MM-DD para DD/MM/YYYY
  function formatDateBR(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Função para dividir um período em meses individuais
  // Retorna array de { start: 'DD/MM/YYYY', end: 'DD/MM/YYYY', label: 'Jan/2025' }
  // Respeita as datas exatas do usuário no primeiro e último mês
  function splitPeriodIntoMonths(startDateISO, endDateISO) {
    const [yearStart, monthStart, dayStart] = startDateISO.split('-').map(Number);
    const [yearEnd, monthEnd, dayEnd] = endDateISO.split('-').map(Number);

    const months = [];
    let year = yearStart;
    let month = monthStart;

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    while (year < yearEnd || (year === yearEnd && month <= monthEnd)) {
      // Primeiro dia: usa a data do usuário no primeiro mês, senão dia 1
      let startDay;
      if (year === yearStart && month === monthStart) {
        startDay = dayStart;
      } else {
        startDay = 1;
      }

      // Último dia: usa a data do usuário no último mês, senão último dia do mês
      let endDay;
      if (year === yearEnd && month === monthEnd) {
        endDay = dayEnd;
      } else {
        endDay = new Date(year, month, 0).getDate();
      }

      months.push({
        start: `${String(startDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
        end: `${String(endDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
        label: `${monthNames[month - 1]}/${year}`
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return months;
  }

  // Calcula a diferença em meses entre duas datas
  function getMonthDiff(startDateISO, endDateISO) {
    const [yearStart, monthStart] = startDateISO.split('-').map(Number);
    const [yearEnd, monthEnd] = endDateISO.split('-').map(Number);
    return (yearEnd - yearStart) * 12 + (monthEnd - monthStart);
  }

  // Define mês anterior como padrão
  const previousDates1 = getMonthDates(1);
  dateStart.value = previousDates1.start;
  dateEnd.value = previousDates1.end;

  // Reseta o select de atalho para "Personalizado" quando o usuário edita as datas manualmente
  function resetShortcutSelect() {
    const select = document.getElementById('dateShortcutSelect');
    if (select) select.value = '';
    chrome.storage.local.remove('dateShortcut');
  }

  // Auto-preenche data final quando data inicial é preenchida
  dateStart.addEventListener('change', function () {
    if (dateStart.value && !dateEnd.value) {
      const [year, month] = dateStart.value.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      dateEnd.value = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }
    resetShortcutSelect();
    populateCompetenciaMonths();
  });

  dateEnd.addEventListener('change', function () {
    resetShortcutSelect();
    populateCompetenciaMonths();
  });

  // Restaura atalho salvo ou usa mês anterior como padrão
  chrome.storage.local.get('dateShortcut', (result) => {
    const select = document.getElementById('dateShortcutSelect');
    if (!select) return;
    const shortcutId = result.dateShortcut || 'prevMonth';
    select.value = shortcutId;
    // Dispara o change para preencher as datas
    select.dispatchEvent(new Event('change'));
  });

  // Event listener para o botão de download (ou confirmar, conforme modo)
  startDownloadBtn.addEventListener('click', () => {
    if (chkConfirmar && chkConfirmar.checked) {
      startConfirmacao();
    } else {
      const selectedType = document.querySelector('input[name="downloadType"]:checked').value;
      startDownload(selectedType);
    }
  });

  // ==========================================
  // Modo Confirmar (checkbox transforma o botão)
  // ==========================================
  const downloadRadioGroup = document.querySelector('.download-radio-group');
  const checkboxRow = downloadRadioGroup?.nextElementSibling; // div com os checkboxes
  const btnIconDownload = document.getElementById('btnIconDownload');
  const btnIconConfirmar = document.getElementById('btnIconConfirmar');
  const btnLabel = document.getElementById('btnLabel');

  const step4Title = document.getElementById('step4Title');
  const bannerTitle = document.getElementById('bannerTitle');
  const certificateBanner = document.querySelector('.certificate-banner');
  const nfseTypeButtons = document.querySelectorAll('.nfse-type-btn');
  const btnEmitidas = nfseTypeButtons[0]; // primeiro botão = Emitidas

  function toggleModoConfirmar(ativo) {
    if (ativo) {
      // Muda títulos e botão para modo confirmar
      if (step4Title) step4Title.textContent = 'Evento de Manifestação de NFS-e - Confirmação do Tomador:';
      if (bannerTitle) bannerTitle.textContent = 'Confirmar NFSe';
      startDownloadBtn.classList.add('modo-confirmar');
      if (certificateBanner) certificateBanner.classList.add('modo-confirmar');
      document.body.classList.add('modo-confirmar');
      if (btnIconDownload) btnIconDownload.style.display = 'none';
      if (btnIconConfirmar) btnIconConfirmar.style.display = '';
      if (btnLabel) btnLabel.textContent = 'Buscar Notas (1/2)';
      // Esconde botão Emitidas
      if (btnEmitidas) btnEmitidas.style.display = 'none';
      // Esconde formato de download e checkboxes irrelevantes
      const formatFieldset = document.getElementById('formatFieldset');
      if (formatFieldset) formatFieldset.style.display = 'none';
      if (downloadRadioGroup) downloadRadioGroup.style.display = 'none';
      document.querySelectorAll('#chkZip, #chkRenameToNNFSe, #chkEscolherPasta').forEach(el => {
        const label = el.closest('label');
        if (label) label.style.display = 'none';
      });
      const filtroRowHide = document.getElementById('filtroNotasRow');
      if (filtroRowHide) filtroRowHide.style.display = 'none';
      const filtroNumRowHide = document.getElementById('filtroNumerosRow');
      if (filtroNumRowHide) filtroNumRowHide.style.display = 'none';
      const loteRowHide = document.getElementById('loteRow');
      if (loteRowHide) loteRowHide.style.display = 'none';
      const loteSubRowHide = document.getElementById('loteSubRow');
      if (loteSubRowHide) loteSubRowHide.style.display = 'none';
      ['subsecFormato', 'subsecFiltro', 'subsecOrganizacao'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      // Esconde seção de pasta customizada
      const folderPickerSection = document.getElementById('folderPickerSection');
      if (folderPickerSection) folderPickerSection.style.display = 'none';
      // Esconde competência (não faz sentido no modo confirmar)
      const compSection = document.getElementById('competenciaSection');
      if (compSection) compSection.style.display = 'none';
      // Esconde seção de relatório (não faz sentido no modo confirmar)
      const relatorioDivider = document.getElementById('relatorioDivider');
      const relatorioSection = document.getElementById('relatorioSection');
      if (relatorioDivider) relatorioDivider.style.display = 'none';
      if (relatorioSection) relatorioSection.style.display = 'none';
    } else {
      // Restaura títulos e botão para modo download
      if (step4Title) step4Title.textContent = 'Formato do download:';
      if (bannerTitle) bannerTitle.textContent = 'Baixar NFSe';
      startDownloadBtn.classList.remove('modo-confirmar');
      if (certificateBanner) certificateBanner.classList.remove('modo-confirmar');
      document.body.classList.remove('modo-confirmar');
      if (btnIconDownload) btnIconDownload.style.display = '';
      if (btnIconConfirmar) btnIconConfirmar.style.display = 'none';
      if (btnLabel) btnLabel.textContent = 'Iniciar Download';
      // Restaura botão Emitidas
      if (btnEmitidas) btnEmitidas.style.display = '';
      // Restaura formato de download e checkboxes
      const formatFieldset = document.getElementById('formatFieldset');
      if (formatFieldset) formatFieldset.style.display = '';
      if (downloadRadioGroup) downloadRadioGroup.style.display = '';
      document.querySelectorAll('#chkZip, #chkRenameToNNFSe').forEach(el => {
        const label = el.closest('label');
        if (label) label.style.display = 'inline-flex';
      });
      const filtroRowShow = document.getElementById('filtroNotasRow');
      if (filtroRowShow) filtroRowShow.style.display = 'flex';
      // filtroNumerosRow só aparece se o modo "faixa" estiver selecionado
      const selectFiltroShow = document.getElementById('selectFiltroNotas');
      const filtroNumRowShow = document.getElementById('filtroNumerosRow');
      if (filtroNumRowShow) {
        filtroNumRowShow.style.display = (selectFiltroShow?.value === 'faixa') ? 'flex' : 'none';
      }
      const loteRowShow = document.getElementById('loteRow');
      if (loteRowShow) loteRowShow.style.display = 'flex';
      // loteSubRow só aparece se o checkbox Lote estiver marcado
      const chkLoteShow = document.getElementById('chkLote');
      const loteSubRowShow = document.getElementById('loteSubRow');
      if (loteSubRowShow) {
        loteSubRowShow.style.display = (chkLoteShow?.checked) ? 'flex' : 'none';
      }
      ['subsecFormato', 'subsecFiltro', 'subsecOrganizacao'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
      });
      // Restaura Pasta se o browser suporta File System Access API
      if (typeof window.showDirectoryPicker === 'function') {
        const lblPasta = document.getElementById('lblEscolherPasta');
        if (lblPasta) lblPasta.style.display = 'inline-flex';
        const chkPasta = document.getElementById('chkEscolherPasta');
        const folderSection = document.getElementById('folderPickerSection');
        if (chkPasta && folderSection && chkPasta.checked) {
          folderSection.style.display = 'block';
        }
      }
      // Restaura competência
      const compSection = document.getElementById('competenciaSection');
      if (compSection) compSection.style.display = 'flex';
      // Restaura seção de relatório
      const relatorioDivider = document.getElementById('relatorioDivider');
      const relatorioSection = document.getElementById('relatorioSection');
      if (relatorioDivider) relatorioDivider.style.display = '';
      if (relatorioSection) relatorioSection.style.display = '';
      // Limpa lista de confirmação e status
      const statusEl = document.getElementById('status');
      if (statusEl) { statusEl.className = ''; statusEl.innerHTML = ''; }
      notasParaSelecao = [];
    }
  }

  if (chkConfirmar) {
    chkConfirmar.addEventListener('change', () => {
      toggleModoConfirmar(chkConfirmar.checked);
    });
  }

  // Armazena notas listadas para confirmação selecionada
  let notasParaSelecao = [];

  // Fluxo de confirmação em lote (agora com seleção)
  async function startConfirmacao() {
    const startDateISO = dateStart.value;
    const endDateISO = dateEnd.value;

    if (!startDateISO || !endDateISO) {
      showStatus('Selecione a data inicial e final!', 'error');
      return;
    }

    if (endDateISO < startDateISO) {
      showStatus('A data final deve ser igual ou posterior à data inicial.', 'error');
      return;
    }

    // Limita a 30 dias (restrição do portal)
    const diffDays = Math.ceil((new Date(endDateISO) - new Date(startDateISO)) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      showStatus('O período não deve ser superior a 30 dias.', 'error');
      return;
    }

    const [ys, ms, ds] = startDateISO.split('-');
    const [ye, me, de] = endDateISO.split('-');
    const startDate = `${ds}/${ms}/${ys}`;
    const endDate = `${de}/${me}/${ye}`;

    showStatus('Verificando sessão no portal...', 'info');
    const sessionResult = await new Promise((resolve) => {
      sendBgMessage({ action: 'checkSession' }, (response) => {
        if (chrome.runtime.lastError) resolve({ loggedIn: false });
        else resolve(response);
      });
    });

    if (!sessionResult || !sessionResult.loggedIn) {
      showStatus('Faça login no portal NFS-e primeiro!', 'error');
      return;
    }

    startDownloadBtn.disabled = true;

    const progressListener = (message) => {
      if (message.action !== 'confirmarProgress') return;
      const p = message.progress;
      if (p.phase === 'extraindo') {
        showStatus(`Buscando notas recebidas... ${p.total || 0} encontrada(s)`, 'info');
      } else if (p.phase === 'eventos') {
        showStatus(`Verificando eventos: ${p.processed || 0}/${p.total || 0} (${p.percent || 0}%)`, 'info');
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    try {
      // Passo 1: Busca notas sem evento (Fases 1-3)
      const result = await new Promise((resolve) => {
        sendBgMessage({
          action: 'listarNotasParaConfirmar',
          dateStart: startDate,
          dateEnd: endDate
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: 'Erro ao comunicar com a extensão.' });
          } else {
            resolve(response);
          }
        });
      });

      chrome.runtime.onMessage.removeListener(progressListener);

      if (!result.success) {
        showStatus(`Erro: ${result.error || 'Erro desconhecido'}`, 'error');
        return;
      }

      if (result.notas.length === 0) {
        showStatus(result.message || 'Nenhuma nota para confirmar.', 'info');
        return;
      }

      // Passo 2: Mostra lista para seleção
      notasParaSelecao = result.notas;
      showListaConfirmacao(result.notas, result.total);

    } catch (error) {
      chrome.runtime.onMessage.removeListener(progressListener);
      showStatus(`Erro: ${error.message}`, 'error');
    } finally {
      startDownloadBtn.disabled = false;
    }
  }

  // Exibe a lista de notas com checkboxes para seleção
  function showListaConfirmacao(notas, totalNotas) {
    const container = document.getElementById('status');
    // Ordena por nome do prestador
    notas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    const count = notas.length;

    let html = `
      <div style="text-align:left;font-size:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <label style="cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px;">
            <input type="checkbox" id="chkSelectAll" style="margin:0;width:11px;height:11px;">
            Selecionar todas (${count} de ${totalNotas})
          </label>
          <span style="color:#888;font-size:9px;">${count} sem evento</span>
        </div>
        <div id="listaNotas" style="max-height:180px;overflow-y:auto;border:1px solid #e5e5e5;border-radius:4px;background:#fff;">`;

    notas.forEach((nota, i) => {
      const valor = nota.valor && nota.valor !== '-' ? parseFloat(nota.valor.replace('.', '').replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      html += `
          <label style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid #f0f0f0;cursor:pointer;${i % 2 === 0 ? 'background:#fafafa;' : ''}">
            <input type="checkbox" class="chkNota" data-index="${i}" style="margin:0;width:11px;height:11px;flex-shrink:0;">
            <span style="flex:0 0 auto;font-weight:600;min-width:28px;">${nota.nNFSe}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${nota.cnpjCpf} - ${nota.nome}">${nota.nome}</span>
            <span style="flex:0 0 auto;color:#555;min-width:50px;text-align:right;">${valor}</span>
          </label>`;
    });

    html += `
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button id="btnConfirmarSelecionadas" disabled style="flex:1;padding:6px;font-size:10px;font-weight:600;background:#dc2626;color:#fff;border:none;border-radius:4px;cursor:pointer;opacity:0.5;">
            ✓ Confirmar selecionadas (0) (2/2)
          </button>
          <button id="btnCancelarConfirmacao" style="flex:0 0 auto;padding:6px 10px;font-size:10px;background:#f5f5f5;color:#666;border:1px solid #ccc;border-radius:4px;cursor:pointer;">
            Cancelar
          </button>
        </div>
      </div>`;

    container.innerHTML = html;
    container.className = 'show';
    container.style.background = '#fff';
    container.style.borderColor = '#e5e5e5';
    container.style.color = '#1a1a1a';

    // Selecionar/desselecionar todas
    const chkAll = document.getElementById('chkSelectAll');
    const btnConfirmar = document.getElementById('btnConfirmarSelecionadas');

    function updateCount() {
      const checked = container.querySelectorAll('.chkNota:checked').length;
      btnConfirmar.textContent = `✓ Confirmar selecionadas (${checked}) (2/2)`;
      btnConfirmar.disabled = checked === 0;
      btnConfirmar.style.opacity = checked === 0 ? '0.5' : '1';
      chkAll.checked = checked === count;
      chkAll.indeterminate = checked > 0 && checked < count;
    }

    chkAll.addEventListener('change', () => {
      container.querySelectorAll('.chkNota').forEach(cb => { cb.checked = chkAll.checked; });
      updateCount();
    });

    container.querySelectorAll('.chkNota').forEach(cb => {
      cb.addEventListener('change', updateCount);
    });

    // Botão Confirmar selecionadas
    btnConfirmar.addEventListener('click', async () => {
      const selecionadas = [];
      container.querySelectorAll('.chkNota:checked').forEach(cb => {
        selecionadas.push(notasParaSelecao[parseInt(cb.dataset.index)]);
      });

      if (selecionadas.length === 0) return;

      btnConfirmar.disabled = true;
      btnConfirmar.textContent = 'Confirmando...';
      document.getElementById('btnCancelarConfirmacao').style.display = 'none';

      const progressListener = (message) => {
        if (message.action !== 'confirmarProgress') return;
        const p = message.progress;
        if (p.phase === 'confirmar' && p.processed > 0) {
          const detalhes = [];
          if (p.confirmed > 0) detalhes.push(`${p.confirmed} ok`);
          if (p.skipped > 0) detalhes.push(`${p.skipped} já`);
          if (p.failed > 0) detalhes.push(`${p.failed} erro`);
          btnConfirmar.textContent = `Confirmando: ${p.processed}/${p.total} (${p.percent}%) ${detalhes.join(', ')}`;
        }
      };
      chrome.runtime.onMessage.addListener(progressListener);

      try {
        const result = await new Promise((resolve) => {
          sendBgMessage({
            action: 'confirmarNotasSelecionadas',
            notas: selecionadas
          }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: 'Erro ao comunicar com a extensão.' });
            } else {
              resolve(response);
            }
          });
        });

        chrome.runtime.onMessage.removeListener(progressListener);

        if (result.success) {
          const partes = [];
          if (result.confirmed > 0) partes.push(`${result.confirmed} confirmada(s)`);
          if (result.skipped > 0) partes.push(`${result.skipped} já confirmada(s)`);
          if (result.failed > 0) partes.push(`${result.failed} erro(s)`);

          // Remove notas confirmadas/já confirmadas da lista e re-exibe
          const chavesConfirmadas = new Set(selecionadas.map(n => n.chave));
          notasParaSelecao = notasParaSelecao.filter(n => !chavesConfirmadas.has(n.chave));

          if (notasParaSelecao.length > 0) {
            // Ainda restam notas — mostra lista atualizada com mensagem de sucesso
            showListaConfirmacao(notasParaSelecao, notasParaSelecao.length);
            // Adiciona mensagem de sucesso acima da lista
            const statusEl = document.getElementById('status');
            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'background:#f0fdf4;color:#166534;border:1px solid #dcfce7;border-radius:4px;padding:4px 6px;margin-bottom:6px;font-size:10px;text-align:center;';
            successMsg.textContent = `✓ ${partes.join(', ')}`;
            statusEl.firstElementChild.prepend(successMsg);
          } else {
            showStatus(`Concluído! ${partes.join(', ')}. Todas as notas foram confirmadas.`, 'success');
          }
        } else if (result.sessionExpired) {
          showStatus(result.message || 'Sessão expirou. Faça login e tente novamente.', 'error');
        } else {
          showStatus(`Erro: ${result.error || 'Erro desconhecido'}`, 'error');
        }
      } catch (error) {
        chrome.runtime.onMessage.removeListener(progressListener);
        showStatus(`Erro: ${error.message}`, 'error');
      }
    });

    // Botão Cancelar
    document.getElementById('btnCancelarConfirmacao').addEventListener('click', () => {
      notasParaSelecao = [];
      container.className = '';
      container.innerHTML = '';
    });
  }

  // Variável para armazenar os arquivos selecionados para relatório
  let selectedReportFiles = null;

  // Elementos para seleção de arquivos XML
  const xmlFilesInput = document.getElementById('xmlFilesInput');
  const dropZone = document.getElementById('dropZone');
  const folderNameSpan = document.getElementById('folderName');

  // Função para processar arquivos selecionados
  async function handleSelectedFiles(files) {
    const fileArray = Array.from(files);
    const xmlFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.xml'));
    const zipFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.zip'));

    // Se houver ZIPs, extrai os XMLs de dentro
    let totalCancelados = 0;
    let totalSubstituidos = 0;
    if (zipFiles.length > 0) {
      showStatus('📂 Extraindo XMLs do ZIP...', 'info');
      for (const zipFile of zipFiles) {
        try {
          const zipData = await zipFile.arrayBuffer();
          const zip = await JSZip.loadAsync(zipData);
          const allXmlEntries = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.xml'));

          for (const entryName of allXmlEntries) {
            const content = await zip.files[entryName].async('blob');
            const fileName = entryName.split('/').pop();
            const file = new File([content], fileName, { type: 'text/xml' });

            // Detecta situação pela pasta de origem no ZIP
            // Inclui nome do ZIP no path para detectar "Manifestacoes.zip"
            const fullPath = zipFile.name + '/' + entryName;
            const pathLower = fullPath.toLowerCase();
            // Manifestações tem prioridade (Manifestacoes/Cancelada/ não é "cancelada" avulsa)
            if (pathLower.includes('manifestacoes') || pathLower.includes('manifestacao') || pathLower.includes('manifestação') || pathLower.includes('manifestações')) {
              file._situacaoZip = 'manifestacao';
              // Extrai subtipo: primeira pasta dentro do ZIP (ex: Rejeicao do Tomador/nota.xml)
              const parts = entryName.split('/');
              if (parts.length >= 2) file._subtipoEvento = parts[0];
            } else if (pathLower.includes('cancelamento/') || pathLower.includes('cancelada/')) {
              file._situacaoZip = 'cancelada';
              totalCancelados++;
            } else if (pathLower.includes('substituicao/') || pathLower.includes('substituida/') || pathLower.includes('substituição/')) {
              file._situacaoZip = 'substituida';
              totalSubstituidos++;
            } else {
              file._situacaoZip = 'normal';
            }

            xmlFiles.push(file);
          }
        } catch (err) {
          showStatus(`❌ Erro ao ler ZIP "${zipFile.name}": ${err.message}`, 'error');
        }
      }
    }

    if (xmlFiles.length > 0) {
      selectedReportFiles = xmlFiles;
      const fromZip = zipFiles.length > 0 ? ' (extraído(s) do ZIP)' : '';
      const situacaoMsg = (totalCancelados + totalSubstituidos) > 0
        ? ` | ${totalCancelados > 0 ? totalCancelados + ' cancelada(s)' : ''}${totalCancelados > 0 && totalSubstituidos > 0 ? ', ' : ''}${totalSubstituidos > 0 ? totalSubstituidos + ' substituída(s)' : ''}`
        : '';
      folderNameSpan.textContent = `${xmlFiles.length} arquivo(s) XML selecionado(s)${fromZip}${situacaoMsg}`;

      exportExcelBtn.disabled = false;
      document.getElementById('exportCustomExcelBtn').disabled = false;

      if (xmlFiles.length > MAX_XML_FILES_EXCEL) {
        reportBtn.disabled = true;
        exportExcelBtn.disabled = true;
        document.getElementById('exportCustomExcelBtn').disabled = true;
        showStatus(`⚠️ ${xmlFiles.length.toLocaleString('pt-BR')} XML(s) encontrado(s). O limite máximo é ${MAX_XML_FILES_EXCEL.toLocaleString('pt-BR')}. Divida em períodos menores.`, 'error');
      } else if (xmlFiles.length > MAX_XML_FILES_HTML) {
        reportBtn.disabled = true;
        showStatus(`📂 ${xmlFiles.length.toLocaleString('pt-BR')} XML(s) encontrado(s). Use o Excel para processar todos os dados. O relatório visual é limitado a ${MAX_XML_FILES_HTML.toLocaleString('pt-BR')}.`, 'info');
      } else {
        reportBtn.disabled = false;
        if (xmlFiles.length > 2000) {
          showStatus(`📂 ${xmlFiles.length.toLocaleString('pt-BR')} XML(s) pronto(s). Volume alto — Excel é recomendado.`, 'info');
        } else {
          showStatus(`✅ ${xmlFiles.length} arquivo(s) XML pronto(s). Escolha o formato.`, 'success');
        }
      }
    } else {
      showStatus('❌ Nenhum arquivo XML encontrado nos arquivos selecionados', 'error');
      folderNameSpan.textContent = '';
      reportBtn.disabled = true;
      exportExcelBtn.disabled = true;
      document.getElementById('exportCustomExcelBtn').disabled = true;
    }
  }

  // Listener para quando o usuário seleciona arquivos
  xmlFilesInput.addEventListener('change', (e) => {
    handleSelectedFiles(e.target.files);
  });

  // Clique no dropZone abre seletor de arquivos
  dropZone.addEventListener('click', () => {
    xmlFilesInput.click();
  });

  // Suporte a drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    // Verifica se arrastou uma pasta (usa webkitGetAsEntry para detectar diretórios)
    const items = e.dataTransfer.items;
    let hasFolder = false;
    const entries = [];
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) {
          entries.push(entry);
          if (entry.isDirectory) hasFolder = true;
        }
      }
    }
    if (hasFolder) {
      // Lê recursivamente pastas arrastadas
      showStatus('📂 Lendo arquivos da pasta...', 'info');
      const xmlFiles = [];
      let totalCancelados = 0;
      let totalSubstituidos = 0;

      // readEntries retorna no máx ~100 por chamada, precisa chamar em loop
      function readAllEntries(reader) {
        return new Promise((resolve, reject) => {
          const allEntries = [];
          function readBatch() {
            reader.readEntries((entries) => {
              if (entries.length === 0) {
                resolve(allEntries);
              } else {
                allEntries.push(...entries);
                readBatch(); // Continua lendo até retornar vazio
              }
            }, reject);
          }
          readBatch();
        });
      }

      async function readEntry(entry, path) {
        if (entry.isFile) {
          if (entry.name.toLowerCase().endsWith('.xml')) {
            const file = await new Promise((resolve) => entry.file(resolve));
            const pathLower = path.toLowerCase();
            // Manifestações tem prioridade (Manifestacoes/Cancelamento/ não é "cancelada")
            if (pathLower.includes('manifestacoes') || pathLower.includes('manifestacao') || pathLower.includes('manifestação') || pathLower.includes('manifestações')) {
              file._situacaoZip = 'manifestacao';
              // Extrai subtipo da subpasta: Manifestacoes/Rejeicao do Tomador/nota.xml
              const manifestMatch = path.match(/manifesta[cç][^/]*\/([^/]+)/i);
              if (manifestMatch && !manifestMatch[1].toLowerCase().endsWith('.xml')) file._subtipoEvento = manifestMatch[1];
            } else if (pathLower.includes('cancelamento') || pathLower.includes('cancelada')) {
              file._situacaoZip = 'cancelada';
              totalCancelados++;
            } else if (pathLower.includes('substituicao') || pathLower.includes('substituida') || pathLower.includes('substituição')) {
              file._situacaoZip = 'substituida';
              totalSubstituidos++;
            } else {
              file._situacaoZip = 'normal';
            }
            xmlFiles.push(file);
          }
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const entries = await readAllEntries(reader);
          for (const child of entries) {
            await readEntry(child, path + '/' + child.name);
            // Sem limite na leitura — o limite é aplicado apenas no relatório HTML
          }
        }
      }

      for (const entry of entries) {
        await readEntry(entry, entry.name);
      }

      if (xmlFiles.length > 0) {
        selectedReportFiles = xmlFiles;
        const situacaoMsg = (totalCancelados + totalSubstituidos) > 0
          ? ` | ${totalCancelados > 0 ? totalCancelados + ' cancelada(s)' : ''}${totalCancelados > 0 && totalSubstituidos > 0 ? ', ' : ''}${totalSubstituidos > 0 ? totalSubstituidos + ' substituída(s)' : ''}`
          : '';
        folderNameSpan.textContent = `${xmlFiles.length} arquivo(s) XML encontrado(s)${situacaoMsg}`;
        exportExcelBtn.disabled = false;
        document.getElementById('exportCustomExcelBtn').disabled = false;

        if (xmlFiles.length > MAX_XML_FILES_EXCEL) {
          reportBtn.disabled = true;
          exportExcelBtn.disabled = true;
          document.getElementById('exportCustomExcelBtn').disabled = true;
          showStatus(`⚠️ ${xmlFiles.length.toLocaleString('pt-BR')} XML(s) encontrado(s). O limite máximo é ${MAX_XML_FILES_EXCEL.toLocaleString('pt-BR')}. Divida em períodos menores.`, 'error');
        } else if (xmlFiles.length > MAX_XML_FILES_HTML) {
          reportBtn.disabled = true;
          showStatus(`📂 ${xmlFiles.length.toLocaleString('pt-BR')} XML(s) encontrado(s). Use o Excel para processar todos os dados. O relatório visual é limitado a ${MAX_XML_FILES_HTML.toLocaleString('pt-BR')}.`, 'info');
        } else {
          reportBtn.disabled = false;
          if (xmlFiles.length > 2000) {
            showStatus(`📂 ${xmlFiles.length.toLocaleString('pt-BR')} XML(s) pronto(s). Volume alto — Excel é recomendado.`, 'info');
          } else {
            showStatus(`✅ ${xmlFiles.length} arquivo(s) XML pronto(s). Escolha o formato.`, 'success');
          }
        }
      } else {
        showStatus('❌ Nenhum arquivo XML encontrado na pasta', 'error');
      }
    } else {
      // Arquivos soltos (comportamento original)
      handleSelectedFiles(e.dataTransfer.files);
    }
  });

  // Event listeners para os botões de relatório
  reportBtn.addEventListener('click', () => generateReport('html'));
  exportExcelBtn.addEventListener('click', () => generateReport('excel'));

  // Excel Personalizado - Configurar (abre em nova aba para não perder os XMLs carregados)
  document.getElementById('configCustomExcelBtn').addEventListener('click', async () => {
    const windowId = await _getTargetWindowId();
    chrome.tabs.create({ url: chrome.runtime.getURL('config-excel.html'), windowId });
  });

  // Excel Personalizado - Gerar
  document.getElementById('exportCustomExcelBtn').addEventListener('click', () => generateReport('custom-excel'));

  // Listener para progresso da extração e download
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Ignora mensagens destinadas ao offscreen document
    if (message.action === 'parsePageHtml' || message.action === 'parseCompanyName') return;

    // Escrita de arquivo na pasta customizada (enviado pelo background)
    if (message.action === 'writeFileToCustomFolder') {
      (async () => {
        try {
          const binaryString = atob(message.dataBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await writeFileToCustomFolder(bytes.buffer, message.filePath);
          sendResponse({ success: true });
        } catch (err) {
          console.error('Erro ao escrever arquivo na pasta personalizada:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    // Aviso de sessão expirada durante keep-alive
    if (message.action === 'sessionExpiredWarning') {
      showStatus('⚠️ ' + message.message, 'error');
      // Esconde o badge da empresa quando a sessão expira
      const badge = document.getElementById('companyBadge');
      if (badge) badge.style.display = 'none';
      return;
    }

    if (message.action === 'extractProgress') {
      const progress = message.progress;

      // Verifica se houve erro (sessão expirada, etc.)
      if (progress.error) {
        showStatus('❌ ' + progress.error, 'error');
        enableButtons();
        return;
      }

      // Aviso de limite de páginas atingido ou páginas puladas
      if (progress.warning) {
        extractWarnings.push(progress.warning);
        showStatus('⚠️ ' + progress.warning, 'info');
        return;
      }

      // Aviso de páginas com erro
      if (progress.pageErrors && progress.pageErrors.length > 0) {
        extractWarnings.push(`${progress.pageErrors.length} página(s) falharam durante a busca. Algumas notas podem não ter sido encontradas.`);
        return;
      }

      // Fase 2: Classificação por eventos (página de visualização)
      if (progress.phase === 'eventos') {
        if (progress.warning) {
          showStatus(`⚠️ ${progress.warning}`, 'error');
          return;
        }
        const isBuscaManif = getFiltroMode() === 'eventos';
        const msgEvento = isBuscaManif
          ? '🔎 Buscando manifestações nos detalhes das notas...'
          : '🔎 Classificando notas por eventos...';
        showStatus(
          `<div style="font-weight:600; margin-bottom:2px;">${msgEvento}</div>` +
          `<div class="progress-container">` +
            `<div class="progress-bar-bg">` +
              `<div class="progress-bar-fill" style="width: ${progress.percent}%"></div>` +
            `</div>` +
            `<div class="progress-info">` +
              `<span>${progress.processed} de ${progress.total}</span>` +
              `<span>${progress.percent}%</span>` +
            `</div>` +
          `</div>`,
          'info', true
        );
        return;
      }

      showStatus(
        `<div style="font-weight:600; margin-bottom:2px;">🔍 Buscando notas no portal...</div>` +
        `<div style="font-size:10px;">Página ${progress.page} · ${progress.total} arquivo(s) encontrado(s)</div>`,
        'info', true
      );
    }

    // Progresso de download em tempo real com barra visual
    if (message.action === 'downloadProgress') {
      const p = message.progress;
      const errMsg = p.errors > 0 ? `<span style="color:#dc2626;">${p.errors} erro(s)</span>` : '';
      const barClass = p.percent >= 100 ? 'complete' : '';
      showStatus(
        `<div style="font-weight:600; margin-bottom:2px;">📥 Baixando arquivos...</div>` +
        `<div class="progress-container">` +
          `<div class="progress-bar-bg">` +
            `<div class="progress-bar-fill ${barClass}" style="width: ${p.percent}%"></div>` +
          `</div>` +
          `<div class="progress-info">` +
            `<span>${p.downloaded} de ${p.total}</span>` +
            `<span>${p.percent}%${errMsg ? ' | ' + errMsg : ''}</span>` +
          `</div>` +
        `</div>`,
        'info', true
      );
    }

    // Progresso de verificação de competência
    if (message.action === 'competenciaProgress') {
      const percent = message.total > 0 ? Math.round((message.checked / message.total) * 100) : 0;
      showStatus(
        `<div style="font-weight:600; margin-bottom:2px;">🔍 Verificando competência...</div>` +
        `<div class="progress-container">` +
          `<div class="progress-bar-bg">` +
            `<div class="progress-bar-fill" style="width: ${percent}%"></div>` +
          `</div>` +
          `<div class="progress-info">` +
            `<span>${message.checked} de ${message.total} nota(s)</span>` +
            `<span>${message.matched} da competência | ${message.skipped} ignorada(s)</span>` +
          `</div>` +
        `</div>`,
        'info', true
      );
    }

    // Sessão expirada durante download — pausa e mostra botão retomar
    if (message.action === 'downloadSessionExpired') {
      const p = message.progress;
      showStatus(
        `<div>⚠️ Sessão expirada durante o download</div>` +
        `<div style="font-size:9px;margin-top:4px;">${p.downloaded} arquivo(s) já baixado(s). Faltam ~${p.remaining}.</div>` +
        `<div style="font-size:9px;margin-top:2px;">Faça login novamente no portal e clique em Retomar.</div>` +
        `<div style="margin-top:8px;">` +
          `<button id="resumeDownloadBtn" style="padding:6px 12px;font-size:10px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">` +
            `Fiz login — Retomar download` +
          `</button>` +
        `</div>`,
        'error', true
      );

      // Espera botão existir no DOM e adiciona listener
      const checkBtn = setInterval(() => {
        const btn = document.getElementById('resumeDownloadBtn');
        if (btn) {
          clearInterval(checkBtn);
          btn.addEventListener('click', () => {
            showStatus('🔄 Retomando downloads...', 'info');
            sendBgMessage({ action: 'resumeDownloads', customFolderMode: isCustomFolderActive() });
          });
        }
      }, 100);
    }
  });

  // Sanitiza nome de empresa para uso em pasta (Windows)
  function sanitizeCompanyFolder(name) {
    let folder = (name || 'NFSe')
      .replace(/[<>:"\/\\|?*]/g, '-')
      .replace(/[\x00-\x1F]/g, '')
      .replace(/\.+$/, '')
      .replace(/\s+$/, '')
      .replace(/^\.+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!folder) folder = 'NFSe';

    // Nomes reservados do Windows (com ou sem extensão)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..+)?$/i;
    if (reservedNames.test(folder)) folder = '_' + folder;

    if (folder.length > 100) folder = folder.substring(0, 100).trim();

    return folder;
  }

  // Sanitiza notaId extraído da URL para uso como nome de arquivo
  function sanitizeFileName(name) {
    try { name = decodeURIComponent(name); } catch (e) { /* mantém original se decode falhar */ }
    return (name || 'nota')
      .replace(/[<>:"\/\\|?*]/g, '-')
      .replace(/[\x00-\x1F]/g, '')
      .replace(/\.+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || 'nota';
  }

  // Processa um único mês: busca links e faz download
  function processOneMonth(monthData, contentType, type, tipoNota, companyFolder, competenciaYYYYMM = null) {
    const filtroMode = getFiltroMode();
    const buscarManifestacoes = filtroMode === 'eventos';
    return new Promise((resolve) => {
      sendBgMessage({
        action: 'extractLinks',
        dateStart: monthData.start,
        dateEnd: monthData.end,
        type: contentType,
        tipoNota: tipoNota,
        buscarManifestacoes: buscarManifestacoes
      }, function (response) {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: 'Erro ao comunicar com a extensão. Tente recarregar.', month: monthData.label });
          return;
        }

        if (!response || !response.links || response.links.length === 0) {
          const errorMsg = response && response.error ? response.error : 'Nenhum arquivo encontrado';
          resolve({ success: true, downloaded: 0, total: 0, failed: 0, month: monthData.label, noFiles: true, error: errorMsg });
          return;
        }

        // Atualiza nome da empresa se ainda não temos
        if (!companyFolder.name && response.companyName) {
          companyFolder.name = sanitizeCompanyFolder(response.companyName);
        }

        // Atribui loteNum a cada link com base na posição na listagem (1-indexed)
        // Assim cada nota carrega seu lote mesmo após filtros de situação
        const loteConfig = getLoteConfig();
        let loteExpectedCounts = null;
        if (loteConfig) {
          response.links.forEach((l, idx) => {
            l.loteNum = Math.ceil((idx + 1) / loteConfig.size);
          });
          // Calcula o nº esperado de notas em cada lote (último pode ter menos)
          loteExpectedCounts = {};
          const totalLotes = Math.ceil(response.links.length / loteConfig.size);
          for (let n = 1; n <= totalLotes; n++) {
            loteExpectedCounts[n] = (n < totalLotes)
              ? loteConfig.size
              : (response.links.length - (totalLotes - 1) * loteConfig.size);
          }
        }

        // Se modo "Somente lotes X a Y", filtra por loteNum antes dos demais filtros
        let linksParaBaixar = response.links;
        if (loteConfig && loteConfig.mode === 'some') {
          const iniL = loteConfig.ini;
          const fimL = loteConfig.fim;
          if (iniL === null || fimL === null || isNaN(iniL) || isNaN(fimL)) {
            resolve({ success: true, downloaded: 0, total: 0, failed: 0, month: monthData.label, noFiles: true, error: 'Informe o nº do lote inicial e final para o modo "Somente lotes"' });
            return;
          }
          if (fimL < iniL) {
            resolve({ success: true, downloaded: 0, total: 0, failed: 0, month: monthData.label, noFiles: true, error: 'Lote final deve ser maior ou igual ao inicial' });
            return;
          }
          linksParaBaixar = linksParaBaixar.filter(l => l.loteNum >= iniL && l.loteNum <= fimL);
          if (linksParaBaixar.length === 0) {
            const faixaLabel = iniL === fimL ? `LOTE ${iniL}` : `lotes ${iniL} a ${fimL}`;
            resolve({ success: true, downloaded: 0, total: 0, failed: 0, month: monthData.label, noFiles: true, error: `Nenhuma nota encontrada em ${faixaLabel}` });
            return;
          }
        }

        // Filtra conforme modo selecionado
        if (filtroMode === 'exceto') {
          linksParaBaixar = linksParaBaixar.filter(l => l.situacao !== 'cancelada' && l.situacao !== 'substituida');
        } else if (filtroMode === 'cs') {
          linksParaBaixar = linksParaBaixar.filter(l => l.situacao === 'cancelada' || l.situacao === 'substituida');
          if (linksParaBaixar.length === 0) {
            resolve({ success: true, downloaded: 0, total: 0, failed: 0, month: monthData.label, noFiles: true, error: 'Nenhuma nota Cancelada ou Substituída encontrada neste período' });
            return;
          }
        } else if (filtroMode === 'faixa') {
          const faixaNum = getFiltroNumeros();
          if (faixaNum) {
            linksParaBaixar = linksParaBaixar.filter(l => {
              const nStr = extractNNFSe(l.chave || '');
              if (!nStr) return false;
              const n = parseInt(nStr, 10);
              if (isNaN(n)) return false;
              if (faixaNum.ini !== null && n < faixaNum.ini) return false;
              if (faixaNum.fim !== null && n > faixaNum.fim) return false;
              return true;
            });
            if (linksParaBaixar.length === 0) {
              const faixaLabel = `${faixaNum.ini ?? '∞'} a ${faixaNum.fim ?? '∞'}`;
              resolve({ success: true, downloaded: 0, total: 0, failed: 0, month: monthData.label, noFiles: true, error: `Nenhuma nota encontrada na faixa ${faixaLabel}` });
              return;
            }
          }
        }

        // Se modo "Buscar manifestações", filtra notas que têm eventos nos detalhes
        // Inclui: manifestação, cancelamento, substituição — qualquer evento encontrado
        if (buscarManifestacoes) {
          linksParaBaixar = linksParaBaixar.filter(l => l.eventos && l.eventos.length > 0);
          if (linksParaBaixar.length === 0) {
            resolve({ success: true, downloaded: 0, total: 0, failed: 0, month: monthData.label, noFiles: true, error: 'Nenhuma manifestação encontrada neste período' });
            return;
          }
        }

        // Conta arquivos baseado no formato real de download
        let totalFiles = 0;
        linksParaBaixar.forEach(link => {
          if ((type === 'xml' || type === 'both') && link.xmlUrl) totalFiles++;
          if ((type === 'pdf' || type === 'both') && link.pdfUrl) totalFiles++;
        });

        let folderName;
        if (competenciaYYYYMM) {
          // Usa datas originais do Período de Geração (não as do split por mês)
          const origStart = document.getElementById('dateStart').value; // "2026-01-01"
          const origEnd = document.getElementById('dateEnd').value;     // "2026-03-07"
          const [sy, sm, sd] = origStart.split('-');
          const [ey, em, ed] = origEnd.split('-');
          const [cy, cm] = competenciaYYYYMM.split('-');
          if (isCustomFolderActive()) {
            const now = new Date();
            const ts = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}${now.getFullYear()}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
            folderName = `${sd}-${sm}-${sy} a ${ed}-${em}-${ey} Competencia ${cm}-${cy} ${tipoNota} ${ts}`;
          } else {
            folderName = `NFSe/${companyFolder.name || 'Empresa'}/${sd}-${sm}-${sy} a ${ed}-${em}-${ey} Competencia ${cm}-${cy} ${tipoNota}`;
          }
        } else {
          const sufixoPasta = buscarManifestacoes ? `Manifestacoes ${tipoNota}` : tipoNota;
          if (isCustomFolderActive()) {
            const now = new Date();
            const ts = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}${now.getFullYear()}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
            folderName = `${monthData.start.replace(/\//g, '-')} a ${monthData.end.replace(/\//g, '-')} ${sufixoPasta} ${ts}`;
          } else {
            folderName = `NFSe/${companyFolder.name || 'Empresa'}/${monthData.start.replace(/\//g, '-')} a ${monthData.end.replace(/\//g, '-')} ${sufixoPasta}`;
          }
        }

        const notasPortal = response.links.length;

        // Se for ZIP, resolve com os links para processar no popup
        const isZip = document.getElementById('chkZip')?.checked || false;
        if (isZip) {
          resolve({ success: true, links: linksParaBaixar, month: monthData.label, total: totalFiles, companyFolder: companyFolder.name, monthData, tipoNota, competenciaYYYYMM, notasPortal, loteConfig, loteExpectedCounts });
          return;
        }

        // Download normal via background script
        const renameToNNFSe = document.getElementById('chkRenameToNNFSe')?.checked || false;
        sendBgMessage({
          action: 'startDownloads',
          links: linksParaBaixar,
          folderName: folderName,
          type: type,
          modoManifestacoes: buscarManifestacoes,
          renameToNNFSe: renameToNNFSe,
          customFolderMode: isCustomFolderActive(),
          competenciaYYYYMM: competenciaYYYYMM,
          loteExpectedCounts: loteExpectedCounts
        }, function (result) {
          if (result && result.success) {
            resolve({
              success: true,
              downloaded: result.downloadedFiles,
              total: result.totalFiles,
              failed: result.failedFiles ? result.failedFiles.length : 0,
              failedFiles: result.failedFiles || [],
              month: monthData.label,
              noFiles: result.competenciaFiltered || false,
              notasPortal
            });
          } else {
            resolve({ success: false, error: result ? result.error : 'Erro desconhecido', month: monthData.label });
          }
        });
      });
    });
  }

  async function startDownload(type) {
    let startDate = dateStart.value;
    let endDate = dateEnd.value;

    // Valida anos razoáveis (evita travamento com anos como 2226)
    if (startDate && endDate) {
      const yearStart = parseInt(startDate.split('-')[0]);
      const yearEnd = parseInt(endDate.split('-')[0]);
      const currentYear = new Date().getFullYear();
      if (yearStart < 2000 || yearStart > currentYear + 5 || yearEnd < 2000 || yearEnd > currentYear + 5) {
        showStatus('⚠️ Ano inválido no período de geração. Verifique as datas informadas.', 'error');
        return;
      }
    }

    // Competência: filtra pela competência dentro do período de geração selecionado
    let competenciaYYYYMM = null;
    const isCompetencia = document.getElementById('chkCompetencia')?.checked || false;
    if (isCompetencia) {
      const selectComp = document.getElementById('selectCompetencia');
      competenciaYYYYMM = selectComp ? selectComp.value : null; // ex: "2026-02"
      if (!competenciaYYYYMM) {
        showStatus('⚠️ Selecione o mês de competência!', 'error');
        return;
      }
      // Mantém as datas de geração do usuário (startDate/endDate)
      // O filtro de competência é aplicado no XML durante o download (dCompet)
    }

    // Valida pasta customizada antes de iniciar
    if (_customFolderEnabled) {
      if (!_customDirHandle) {
        showStatus('⚠️ Nenhuma pasta de destino selecionada. Clique em "Selecionar" para escolher uma pasta.', 'error');
        return;
      }
      try {
        const perm = await _customDirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          showStatus('⚠️ Permissão da pasta expirada. <a href="#" id="linkReauth1" style="color:#2563eb; font-weight:600; text-decoration:underline;">Clique aqui para reautorizar</a>', 'error', true);
          setTimeout(() => { const lnk = document.getElementById('linkReauth1'); if (lnk) lnk.addEventListener('click', (e) => { e.preventDefault(); reauthorizeFolder(); }); }, 50);
          return;
        }
      } catch (err) {
        showStatus('⚠️ Erro ao verificar permissão da pasta: ' + err.message, 'error');
        return;
      }
      // Verifica se a pasta ainda existe no disco
      try {
        for await (const _ of _customDirHandle.values()) { break; }
      } catch {
        showStatus('⚠️ A pasta "' + _customDirHandle.name + '" não existe mais. Selecione uma nova pasta.', 'error');
        return;
      }
    }

    // Valida se as datas foram preenchidas
    if (!startDate) {
      showStatus('⚠️ Selecione a data inicial!', 'error');
      return;
    }

    if (!endDate) {
      showStatus('⚠️ Selecione a data final!', 'error');
      return;
    }

    // Valida se a data final é maior ou igual à inicial
    if (endDate < startDate) {
      showStatus('⚠️ A data final deve ser igual ou posterior à data inicial.', 'error');
      return;
    }

    // Valida limite de 12 meses
    const monthDiff = getMonthDiff(startDate, endDate);
    if (monthDiff > 11) {
      showStatus('⚠️ Período máximo permitido: 12 meses. Reduza o período e tente novamente.', 'error');
      return;
    }

    // Valida faixa de números (se modo "faixa" ativo)
    if (getFiltroMode() === 'faixa') {
      const iniInp = document.getElementById('inputNumIni');
      const fimInp = document.getElementById('inputNumFim');
      const iniVazio = !iniInp?.value?.trim();
      const fimVazio = !fimInp?.value?.trim();
      if (iniVazio && fimVazio) {
        if (iniInp) iniInp.style.borderColor = '#dc2626';
        if (fimInp) fimInp.style.borderColor = '#dc2626';
        showStatus('⚠️ Informe o nº inicial e/ou final da faixa de NFS-e.', 'error');
        return;
      }
      if (iniInp) iniInp.style.borderColor = '#e5e5e5';
      if (!validarFaixaNumeros()) {
        showStatus('⚠️ O nº final deve ser maior ou igual ao nº inicial.', 'error');
        return;
      }
    }

    // Valida tamanho do lote (se Lote ativo)
    if (document.getElementById('chkLote')?.checked && !validarTamanhoLote()) {
      showStatus('⚠️ Informe um tamanho válido para o lote (ex: 500).', 'error');
      return;
    }

    // Valida faixa de lotes (se modo "Somente lotes" ativo)
    const loteCfgCheck = getLoteConfig();
    if (loteCfgCheck && loteCfgCheck.mode === 'some') {
      const iniInp = document.getElementById('loteIni');
      const fimInp = document.getElementById('loteFim');
      const iniVazio = !iniInp?.value?.trim();
      const fimVazio = !fimInp?.value?.trim();
      if (iniVazio || fimVazio) {
        if (iniInp) iniInp.style.borderColor = iniVazio ? '#dc2626' : '#e5e5e5';
        if (fimInp) fimInp.style.borderColor = fimVazio ? '#dc2626' : '#e5e5e5';
        showStatus('⚠️ Informe o nº do lote inicial e final para o modo "Somente lotes".', 'error');
        return;
      }
      if (loteCfgCheck.fim < loteCfgCheck.ini) {
        if (fimInp) fimInp.style.borderColor = '#dc2626';
        showStatus('⚠️ O lote final deve ser maior ou igual ao lote inicial.', 'error');
        return;
      }
      if (iniInp) iniInp.style.borderColor = '#e5e5e5';
      if (fimInp) fimInp.style.borderColor = '#e5e5e5';
    }

    // Desabilita o botão durante o download
    startDownloadBtn.disabled = true;

    // Flag ZIP: checkbox independente do formato
    const isZip = document.getElementById('chkZip')?.checked || false;

    // Determina contentType para buscar no portal
    // Para PDF com competência, busca 'both' (precisa do XML para verificar dCompet)
    let contentType = type;
    if (competenciaYYYYMM && type === 'pdf') contentType = 'both';
    const typeLabel = type === 'xml' ? 'XMLs' : type === 'pdf' ? 'PDFs' : 'arquivos';

    try {
      // Detecta tipo de NFS-e pelo último botão clicado
      const buscarManifestacoes = getFiltroMode() === 'eventos';
      const lastNfseType = document.body.getAttribute('data-nfse-type');
      let tipoNota = lastNfseType || null;

      if (!tipoNota) {
        showStatus('⚠️ Selecione o tipo de NFS-e primeiro! Use o passo 2 acima.', 'error');
        const step2 = document.getElementById('step2');
        step2.classList.add('highlight');
        step2.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => step2.classList.remove('highlight'), 3000);
        enableButtons();
        return;
      }

      // Verifica se está logado no portal antes de iniciar
      showStatus('🔐 Verificando sessão no portal...', 'info');
      const sessionResult = await new Promise((resolve) => {
        sendBgMessage({ action: 'checkSession' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ loggedIn: false });
          } else {
            resolve(response);
          }
        });
      });

      if (!sessionResult || !sessionResult.loggedIn) {
        showStatus('⚠️ Faça login no portal NFS-e primeiro! Acesse o portal no passo 1 e faça login.', 'error');
        const step1 = document.getElementById('step1');
        if (step1) {
          step1.classList.add('highlight');
          step1.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => step1.classList.remove('highlight'), 3000);
        }
        enableButtons();
        return;
      }

      // Divide o período em meses
      const months = splitPeriodIntoMonths(startDate, endDate);
      const totalMonths = months.length;
      const isMultiMonth = totalMonths > 1;

      if (isMultiMonth) {
        const monthLabels = months.map(m => m.label).join(', ');
        showStatus(`📅 Processando ${totalMonths} meses (${monthLabels})...`, 'info');
      } else {
        showStatus(`🔍 Buscando ${typeLabel} em todas as páginas...`, 'info');
      }

      // Objeto compartilhado para nome da empresa (preenchido no primeiro mês)
      const companyFolder = { name: null };

      // Resultados acumulados
      let totalDownloaded = 0;
      let totalFiles = 0;
      let totalFailed = 0;
      let allFailedFiles = [];
      let monthsCompleted = 0;
      let monthsWithError = [];
      let monthsEmpty = [];
      let totalZipNotas = 0;
      let totalZipErrors = 0;
      let totalNotasPortal = 0;
      let extractWarnings = [];
      // Resultados por lote (ZIP): { loteNum: { expected, downloaded, errors } }
      let loteResultsAcc = null;

      // Processa cada mês sequencialmente
      for (let i = 0; i < months.length; i++) {
        const monthData = months[i];

        if (isMultiMonth) {
          showStatus(
            `<div style="font-weight:600; margin-bottom:2px;">📅 Mês ${i + 1} de ${totalMonths}</div>` +
            `<div style="font-size:10px;">${monthData.label} · Buscando ${typeLabel}...</div>`,
            'info', true
          );
        }

        const result = await processOneMonth(monthData, contentType, type, tipoNota, companyFolder, competenciaYYYYMM);

        if (result.success) {
          totalNotasPortal += result.notasPortal || 0;
          // Para ZIP, processa aqui
          if (isZip && result.links) {
            let sufixoZip;
            const parteManifestacao = buscarManifestacoes ? 'Manifestacoes ' : '';
            if (competenciaYYYYMM) {
              const [cy, cm] = competenciaYYYYMM.split('-');
              sufixoZip = `Competencia ${cm}-${cy} ${parteManifestacao}${tipoNota}`;
            } else {
              sufixoZip = `${parteManifestacao}${tipoNota}`;
            }
            if (result.loteConfig && result.loteExpectedCounts) {
              // Agrupa links por loteNum e gera um ZIP separado por lote
              const byLote = {};
              for (const l of result.links) {
                const n = l.loteNum || 0;
                if (!byLote[n]) byLote[n] = [];
                byLote[n].push(l);
              }
              const loteNums = Object.keys(byLote).map(Number).sort((a, b) => a - b);
              if (!loteResultsAcc) loteResultsAcc = {};
              for (const n of loteNums) {
                const expected = result.loteExpectedCounts[n] ?? byLote[n].length;
                const loteSuffix = `LOTE ${n} (${expected} notas)`;
                const loteLinks = byLote[n];
                // Total aproximado de arquivos desse lote (xml + pdf conforme tipo)
                let loteTotal = 0;
                loteLinks.forEach(link => {
                  if ((type === 'xml' || type === 'both') && link.xmlUrl) loteTotal++;
                  if ((type === 'pdf' || type === 'both') && link.pdfUrl) loteTotal++;
                });
                const zipResult = await downloadAsZip(loteLinks, companyFolder.name || 'Empresa', monthData.start, monthData.end, sufixoZip, loteTotal, competenciaYYYYMM, type, loteSuffix);
                if (zipResult) {
                  totalZipNotas += zipResult.downloaded || 0;
                  totalZipErrors += zipResult.errors || 0;
                }
                const prev = loteResultsAcc[n] || { expected: 0, downloaded: 0, errors: 0 };
                loteResultsAcc[n] = {
                  expected: prev.expected + expected,
                  downloaded: prev.downloaded + (zipResult?.downloaded || 0),
                  errors: prev.errors + (zipResult?.errors || 0)
                };
              }
            } else {
              const zipResult = await downloadAsZip(result.links, companyFolder.name || 'Empresa', monthData.start, monthData.end, sufixoZip, result.total, competenciaYYYYMM, type);
              if (zipResult) {
                totalZipNotas += zipResult.downloaded || 0;
                totalZipErrors += zipResult.errors || 0;
              }
            }
            monthsCompleted++;
          } else if (result.noFiles) {
            monthsEmpty.push(monthData.label);
          } else {
            totalDownloaded += result.downloaded || 0;
            totalFiles += result.total || 0;
            totalFailed += result.failed || 0;
            if (result.failedFiles) allFailedFiles = allFailedFiles.concat(result.failedFiles);
            monthsCompleted++;
          }
        } else {
          monthsWithError.push({ month: monthData.label, error: result.error });
          // Se for sessão expirada, pausa e oferece retomar
          const isSessionError = result.error && (
            result.error.includes('sessão') ||
            result.error.includes('Sessão') ||
            result.error.includes('login') ||
            result.error.includes('Login')
          );

          if (isSessionError && isMultiMonth && i < months.length - 1) {
            const remainingMonths = months.slice(i);
            const remainingLabels = remainingMonths.map(m => m.label).join(', ');

            showStatus(
              `<div>⚠️ Sessão expirada no mês ${i + 1}/${totalMonths} (${monthData.label})</div>` +
              `<div style="margin-top:4px;font-size:9px;">${monthsCompleted} mês(es) já baixado(s) com sucesso.</div>` +
              `<div style="margin-top:4px;font-size:9px;">Faltam: ${remainingLabels}</div>` +
              `<div style="margin-top:8px;">` +
                `<button id="resumeBtn" style="padding:6px 12px;font-size:10px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">` +
                  `Fiz login — Retomar de ${monthData.label}` +
                `</button>` +
              `</div>`,
              'error', true
            );

            // Aguarda o clique no botão Retomar
            const resumed = await new Promise((resolve) => {
              // Espera o botão existir no DOM
              const checkBtn = setInterval(() => {
                const btn = document.getElementById('resumeBtn');
                if (btn) {
                  clearInterval(checkBtn);
                  btn.addEventListener('click', () => resolve(true));
                }
              }, 100);
            });

            if (resumed) {
              showStatus(`🔄 Retomando de ${monthData.label}...`, 'info');
              // Volta o índice para reprocessar este mês
              i--;
              monthsWithError.pop(); // Remove o erro que acabou de registrar
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          } else if (isSessionError) {
            showStatus(
              `<div>${result.error}</div>` +
              `<div style="margin-top:4px;font-size:9px;">${monthsCompleted} mês(es) já foram baixados com sucesso.</div>`,
              'error', true
            );
            enableButtons();
            return;
          }
        }

        // Pausa entre meses para não sobrecarregar o portal
        if (isMultiMonth && i < months.length - 1) {
          showStatus(
            `<div style="font-weight:600; margin-bottom:2px;">✅ Mês ${i + 1} de ${totalMonths} concluído</div>` +
            `<div style="font-size:10px;">${monthData.label} · Aguardando próximo mês...</div>`,
            'info', true
          );
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Resumo final
      if (isZip) {
        if (monthsCompleted === 0 && monthsEmpty.length > 0) {
          const buscarManif = getFiltroMode() === 'eventos';
          if (buscarManif) {
            showStatus('ℹ️ Nenhuma manifestação encontrada no período selecionado.', 'info');
          } else if (competenciaYYYYMM) {
            const [cy, cm] = competenciaYYYYMM.split('-');
            showStatus(`ℹ️ Nenhuma nota da competência ${cm}/${cy} encontrada no período.`, 'info');
          } else {
            showStatus('❌ Nenhum arquivo encontrado para o período selecionado. Verifique se existem notas no portal para este período.', 'error');
          }
        } else if (isMultiMonth && monthsCompleted > 0) {
          let summary = `<div>✅ ZIP concluído! ${totalZipNotas} nota(s) baixada(s) de ${totalNotasPortal} encontrada(s).</div>`;
          if (totalZipErrors > 0) summary += `<div style="font-size:9px;margin-top:4px;color:#dc2626;">${totalZipErrors} erro(s)</div>`;
          if (monthsEmpty.length > 0) summary += `<div style="font-size:9px;margin-top:4px;">${monthsEmpty.length} mês(es) sem notas</div>`;
          showStatus(summary, totalZipErrors > 0 ? 'error' : 'success', true);
        }
        // Resumo por lote (sobrescreve ou acrescenta quando houve Lote ativo)
        if (loteResultsAcc && Object.keys(loteResultsAcc).length > 0) {
          const nums = Object.keys(loteResultsAcc).map(Number).sort((a, b) => a - b);
          let temIncompleto = false;
          let linhas = '';
          let totalExp = 0, totalDown = 0;
          for (const n of nums) {
            const r = loteResultsAcc[n];
            totalExp += r.expected; totalDown += r.downloaded;
            const ok = r.downloaded >= r.expected && r.errors === 0;
            if (!ok) temIncompleto = true;
            const icone = ok ? '✅' : '⚠️';
            const cor = ok ? '#16a34a' : '#dc2626';
            linhas += `<div style="font-size:10px; color:${cor}; display:flex; justify-content:space-between; padding:1px 0;"><span>LOTE ${n}:</span><span>${r.downloaded}/${r.expected} ${icone}${r.errors > 0 ? ` (${r.errors} erro)` : ''}</span></div>`;
          }
          const titulo = temIncompleto ? '⚠️ Lotes incompletos detectados' : '✅ Todos os lotes completos';
          const tituloCor = temIncompleto ? '#dc2626' : '#16a34a';
          const resumoLote =
            `<div style="font-weight:600; color:${tituloCor}; margin-bottom:4px;">${titulo}</div>` +
            `<div style="max-height:160px; overflow-y:auto; padding:4px 8px; background:#fafafa; border:1px solid #e5e5e5; border-radius:4px;">${linhas}</div>` +
            `<div style="font-size:10px; margin-top:6px; text-align:right;"><b>Total: ${totalDown}/${totalExp} notas</b></div>` +
            (temIncompleto ? `<div style="font-size:9px; color:#64748b; margin-top:4px;">💡 Para refazer um lote: marque "Somente lotes" e informe o número.</div>` : '');
          showStatus(resumoLote, temIncompleto ? 'error' : 'success', true);
        }
        enableButtons();
        return;
      }

      if (isMultiMonth) {
        let summary = `<div>✅ Download concluído! ${totalMonths} mês(es) processado(s).</div>`;
        summary += `<div style="font-size:9px;margin-top:4px;">${totalDownloaded} arquivo(s) baixado(s)`;
        if (totalFailed > 0) summary += ` | ${totalFailed} erro(s)`;
        if (monthsEmpty.length > 0) summary += ` | ${monthsEmpty.length} mês(es) sem notas`;
        summary += '</div>';

        if (monthsWithError.length > 0) {
          summary += `<div style="color:#991b1b;margin-top:4px;font-size:9px;">Meses com erro: ${monthsWithError.map(m => m.month).join(', ')}</div>`;
        }

        if (allFailedFiles.length > 0) {
          const failedList = allFailedFiles.slice(0, 20).map(f =>
            `<div style="text-align:left;padding:2px 0;font-size:9px;">• ${f.fileName}: ${f.error}</div>`
          ).join('');
          summary += `<div style="max-height:80px;overflow-y:auto;margin-top:4px;">${failedList}</div>`;
          if (allFailedFiles.length > 20) {
            summary += `<div style="font-size:9px;color:#666;">... e mais ${allFailedFiles.length - 20} erro(s)</div>`;
          }
        }

        showStatus(summary, totalFailed > 0 || monthsWithError.length > 0 ? 'error' : 'success', true);
      } else {
        // Resultado de mês único (igual ao comportamento anterior)
        if (allFailedFiles.length > 0) {
          const failedList = allFailedFiles.map(f =>
            `<div style="text-align:left;padding:2px 0;font-size:9px;">• ${f.fileName}: ${f.error}</div>`
          ).join('');
          showStatus(
            `<div>✅ ${totalDownloaded} arquivo(s) baixado(s) de ${totalNotasPortal} nota(s) encontrada(s)</div>` +
            `<div style="color:#991b1b;margin-top:6px;font-weight:600;">${allFailedFiles.length} arquivo(s) com erro:</div>` +
            `<div style="max-height:120px;overflow-y:auto;margin-top:4px;">${failedList}</div>`,
            'error', true
          );
        } else if (totalDownloaded > 0) {
          const portalInfo = totalNotasPortal > 0 ? `<div style="font-size:10px;color:#666;margin-top:4px;">${totalNotasPortal} nota(s) encontrada(s) no portal · ${totalDownloaded} arquivo(s) baixado(s)</div>` : '';
          const warningInfo = extractWarnings.length > 0 ? `<div style="font-size:10px;color:#dc2626;margin-top:4px;">⚠️ ${extractWarnings.join('<br>')}</div>` : '';
          showStatus(
            `<div style="font-weight:600;">✅ Download concluído!</div>` +
            `<div class="progress-container">` +
              `<div class="progress-bar-bg">` +
                `<div class="progress-bar-fill complete" style="width: 100%"></div>` +
              `</div>` +
              `<div class="progress-info">` +
                `<span>${totalDownloaded} arquivo(s) baixado(s)</span>` +
                `<span>100%</span>` +
              `</div>` +
            `</div>` +
            portalInfo +
            warningInfo,
            extractWarnings.length > 0 ? 'error' : 'success', true
          );
        } else if (monthsEmpty.length > 0) {
          const buscarManif = getFiltroMode() === 'eventos';
          if (buscarManif) {
            showStatus('ℹ️ Nenhuma manifestação encontrada no período selecionado.', 'info');
          } else if (competenciaYYYYMM) {
            const [cy, cm] = competenciaYYYYMM.split('-');
            showStatus(`ℹ️ Nenhuma nota da competência ${cm}/${cy} encontrada no período.`, 'info');
          } else {
            showStatus('❌ Nenhum arquivo encontrado para o período selecionado. Verifique se existem notas no portal para este período.', 'error');
          }
        }
      }

      enableButtons();
    } catch (error) {
      showStatus('❌ Erro ao processar: ' + error.message, 'error');
      enableButtons();
    }
  }

  async function downloadAsZip(links, companyFolder, startDateBR, endDateBR, tipoNota, totalFiles, competenciaYYYYMM = null, downloadType = 'xml', loteSuffix = '') {
    const includeXml = downloadType === 'xml' || downloadType === 'both';
    const includePdf = downloadType === 'pdf' || downloadType === 'both';

    // Filtra links que possuem pelo menos uma URL do tipo solicitado
    const validLinks = links.filter(l => (includeXml && l.xmlUrl) || (includePdf && l.pdfUrl));

    if (validLinks.length === 0) {
      const tipoArq = includeXml && includePdf ? 'arquivos' : includeXml ? 'XMLs' : 'PDFs';
      showStatus(`❌ Nenhum ${tipoArq} encontrado para compactar.`, 'error');
      enableButtons();
      return;
    }

    const tipoArqLabel = includeXml && includePdf ? 'arquivo(s)' : includeXml ? 'XML(s)' : 'PDF(s)';
    showStatus(`📥 Baixando ${validLinks.length} ${tipoArqLabel} para compactar...`, 'info');

    const zip = new JSZip();
    let downloaded = 0;
    let errors = 0;
    let skippedCompetencia = 0;
    const renameToNNFSe = document.getElementById('chkRenameToNNFSe')?.checked || false;

    // Função auxiliar para fetch com timeout
    async function fetchContent(url, isBinary = false) {
      if (_isIncognito) {
        const response = await portalFetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return isBinary ? await response.arrayBuffer() : await response.text();
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await portalFetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return isBinary ? await response.arrayBuffer() : await response.text();
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    // Processa em lotes de 5 para não sobrecarregar
    const BATCH_SIZE = 5;
    for (let i = 0; i < validLinks.length; i += BATCH_SIZE) {
      const batch = validLinks.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (linkData) => {
          // Determina o nome base do arquivo
          const refUrl = linkData.xmlUrl || linkData.pdfUrl;
          const urlParts = refUrl.split('/');
          const notaId = sanitizeFileName(urlParts[urlParts.length - 1]);
          const nNFSe = renameToNNFSe ? extractNNFSe(notaId) : null;
          const isRecebidas = tipoNota.includes('Recebidas');
          const cnpj = (renameToNNFSe && isRecebidas && nNFSe && linkData.cnpjCpf) ? linkData.cnpjCpf.replace(/[.\-\/]/g, '') : null;
          const baseName = nNFSe ? (cnpj ? `${cnpj}_${nNFSe}` : nNFSe) : notaId;

          // Define subpasta baseada na situação da NFS-e
          let subFolder = '';
          if (linkData.situacao === 'substituida') subFolder = 'Substituida/';
          else if (linkData.situacao === 'cancelada') subFolder = 'Cancelada/';
          else if (linkData.situacao === 'manifestacao' && linkData.subtipoEvento) {
            const subtipo = linkData.subtipoEvento
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .replace(/[<>:"/\\|?*]/g, '').replace(/\s{2,}/g, ' ').trim();
            if (subtipo) subFolder = subtipo + '/';
          }

          // Baixa XML se necessário
          let xmlText = null;
          if (includeXml && linkData.xmlUrl) {
            xmlText = await fetchContent(linkData.xmlUrl, false);
          }

          // Filtro por competência: verifica dCompet no XML
          if (competenciaYYYYMM) {
            // Se temos XML, usa ele para filtrar; se não, precisa baixar o XML só para verificar
            let textForCheck = xmlText;
            if (!textForCheck && linkData.xmlUrl) {
              textForCheck = await fetchContent(linkData.xmlUrl, false);
            }
            if (textForCheck) {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(textForCheck, 'text/xml');
              const dCompetEl = xmlDoc.getElementsByTagName('dCompet')[0];
              if (dCompetEl) {
                const dCompet = dCompetEl.textContent || '';
                const compMes = dCompet.substring(0, 7);
                if (compMes !== competenciaYYYYMM) {
                  skippedCompetencia++;
                  return 'skipped';
                }
              }
            }
          }

          // Adiciona XML ao ZIP
          if (includeXml && xmlText) {
            zip.file(`${subFolder}${baseName}.xml`, xmlText);
          }

          // Baixa e adiciona PDF ao ZIP
          if (includePdf && linkData.pdfUrl) {
            const pdfData = await fetchContent(linkData.pdfUrl, true);
            zip.file(`${subFolder}${baseName}.pdf`, pdfData);
          }
        })
      );

      results.forEach(r => {
        if (r.status === 'fulfilled') {
          if (r.value !== 'skipped') downloaded++;
        } else {
          errors++;
        }
      });

      const processados = downloaded + errors + skippedCompetencia;
      const zipPercent = Math.round((processados / validLinks.length) * 100);
      const zipErrMsg = errors > 0 ? `<span style="color:#dc2626;">${errors} erro(s)</span>` : '';
      const compMsg = competenciaYYYYMM && skippedCompetencia > 0 ? ` | ${skippedCompetencia} fora da competência` : '';
      showStatus(
        `<div style="font-weight:600; margin-bottom:2px;">📥 Baixando ${tipoArqLabel} para ZIP...</div>` +
        `<div class="progress-container">` +
          `<div class="progress-bar-bg">` +
            `<div class="progress-bar-fill" style="width: ${zipPercent}%"></div>` +
          `</div>` +
          `<div class="progress-info">` +
            `<span>${processados} de ${validLinks.length}</span>` +
            `<span>${zipPercent}%${zipErrMsg ? ' | ' + zipErrMsg : ''}${compMsg}</span>` +
          `</div>` +
        `</div>`,
        'info', true
      );
    }

    if (downloaded === 0) {
      if (competenciaYYYYMM && skippedCompetencia > 0) {
        const [cy, cm] = competenciaYYYYMM.split('-');
        showStatus(`ℹ️ Nenhuma nota da competência ${cm}/${cy} encontrada. ${skippedCompetencia} nota(s) verificada(s) são de outra competência.`, 'info');
      } else {
        showStatus(`❌ Nenhum ${tipoArqLabel} pôde ser baixado.`, 'error');
      }
      enableButtons();
      return;
    }

    showStatus('📦 Gerando arquivo ZIP...', 'info');

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    // Salva o ZIP — se Pasta ativa, salva direto na pasta selecionada (sem subpastas) com timestamp
    const suffixo = loteSuffix ? ` ${loteSuffix}` : '';
    const baseName = `${startDateBR.replace(/\//g, '-')} a ${endDateBR.replace(/\//g, '-')} ${tipoNota}${suffixo}`;
    if (isCustomFolderActive()) {
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}${now.getFullYear()}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
      var zipPath = `${baseName} ${timestamp}.zip`;
    } else {
      var zipPath = `NFSe/${companyFolder}/${baseName}.zip`;
    }

    try {
      await downloadBlobSmart(zipBlob, zipPath);
    } catch (err) {
      console.error('Erro ao salvar ZIP:', err);
    }

    const msg = errors > 0
      ? `✅ ZIP gerado com ${downloaded} nota(s)! (${errors} erro(s))`
      : `✅ ZIP gerado com ${downloaded} nota(s)!`;
    showStatus(msg, 'success');
    enableButtons();
    return { downloaded, errors };
  }

  function enableButtons() {
    startDownloadBtn.disabled = false;
  }

  function showStatus(message, type, isHtml = false) {
    if (isHtml) {
      status.innerHTML = message;
    } else {
      status.textContent = message;
    }
    status.className = 'show';

    // Define cores baseadas no tipo (minimalista)
    if (type === 'success') {
      status.style.background = '#f0fdf4';
      status.style.borderColor = '#dcfce7';
      status.style.color = '#166534';
    } else if (type === 'error') {
      status.style.background = '#fef2f2';
      status.style.borderColor = '#fecaca';
      status.style.color = '#991b1b';
    } else {
      status.style.background = '#f5f5f5';
      status.style.borderColor = '#e5e5e5';
      status.style.color = '#1a1a1a';
    }
  }

  // Função para detectar o tipo de nota baseado no nome da pasta
  function detectTipoNota(folderName) {
    const lowerName = folderName.toLowerCase();
    if (lowerName.includes('emitida')) return 'Emitida';
    if (lowerName.includes('recebida')) return 'Recebida';
    return '-';
  }

  // Função para detectar a situação da nota (Normal, Substituída, Cancelada, Manifestação)
  // Verifica: 1) _situacaoZip, 2) nome da pasta (manifestações tem prioridade), 3) cStat do XML
  // Retorna { situacao, origem } onde origem = 'pasta' ou 'xml'
  function detectSituacaoNota(file, xmlDoc, folderHint) {
    // 1. Verifica propriedade _situacaoZip (marcada durante extração do ZIP)
    if (file._situacaoZip === 'cancelada') return { situacao: 'cancelada', origem: 'pasta' };
    if (file._situacaoZip === 'substituida') return { situacao: 'substituida', origem: 'pasta' };
    if (file._situacaoZip === 'manifestacao') return { situacao: 'manifestacao', origem: 'pasta' };

    // 2. Verifica nome da pasta — "manifestacoes/" tem prioridade sobre subpastas
    // Ex: Manifestacoes/Cancelamento/nota.xml → deve ser 'manifestacao' (não 'cancelada')
    const pathLower = (file.webkitRelativePath || folderHint || '').toLowerCase();
    if (pathLower.includes('manifestacoes') || pathLower.includes('manifestacao') || pathLower.includes('manifestação')) {
      return { situacao: 'manifestacao', origem: 'pasta' };
    }

    // 3. Verifica outras pastas (nomes antigos e novos)
    if (pathLower.includes('cancelamento') || pathLower.includes('cancelada')) return { situacao: 'cancelada', origem: 'pasta' };
    if (pathLower.includes('substituicao') || pathLower.includes('substituida') || pathLower.includes('substituição')) return { situacao: 'substituida', origem: 'pasta' };

    // 4. Verifica cStat no XML (código de status da NFS-e)
    const cStat = xmlDoc.querySelector('infNFSe cStat')?.textContent ||
      xmlDoc.querySelector('cStat')?.textContent || '';
    if (cStat === '3' || cStat === '4') return { situacao: 'cancelada', origem: 'xml' };    // 3=Cancelada, 4=Cancelada por Substituição
    if (cStat === '2') return { situacao: 'substituida', origem: 'xml' };                     // 2=Substituída

    return { situacao: 'normal', origem: '' };
  }

  // Função para ler XMLs de uma pasta (e subpastas opcionalmente)
  // Limite de segurança para evitar travamento em pastas muito grandes
  const MAX_FILES_TO_SCAN = 120000;
  const MAX_XML_FILES_HTML = 3000; // Limite apenas para relatório HTML (performance do navegador)
  const MAX_XML_FILES_EXCEL = 100000; // Limite de segurança para Excel

  async function readXmlsFromDirectory(directoryHandle, recursive = false, parentFolderName = '', fullPath = '') {
    const xmlFiles = [];
    const currentFolderName = parentFolderName || directoryHandle.name;
    const currentFullPath = fullPath ? `${fullPath}/${currentFolderName}` : currentFolderName;
    let filesScanned = 0;
    let limitReached = false; // Flag para avisar o usuário

    try {
      for await (const entry of directoryHandle.values()) {
        // Limite de segurança para evitar travamento
        filesScanned++;
        if (filesScanned > MAX_FILES_TO_SCAN) {
          console.warn(`Limite de ${MAX_FILES_TO_SCAN} arquivos atingido na pasta ${currentFolderName}`);
          limitReached = true;
          break;
        }

        // Sem limite na leitura — o limite é aplicado apenas no relatório HTML

        try {
          if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.xml')) {
            const file = await entry.getFile();
            const content = await file.text();

            // Parse do XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'text/xml');

            // Extrai os dados necessários
            const nNFSe = xmlDoc.querySelector('nNFSe')?.textContent || '-';
            const serie = xmlDoc.querySelector('infDPS > serie, serie')?.textContent || '-';
            const nDPS = xmlDoc.querySelector('infDPS > nDPS, nDPS')?.textContent || '-';
            // dCompet = Data de Competência (data em que o serviço foi prestado)
            const dCompet = xmlDoc.querySelector('dCompet')?.textContent || '-';
            // dhEmi = Data da Geração/Emissão (data em que foi transmitido)
            const dhEmi = xmlDoc.querySelector('infDPS dhEmi')?.textContent ||
              xmlDoc.querySelector('DPS dhEmi')?.textContent ||
              xmlDoc.querySelector('dhEmi')?.textContent || '-';
            const prestador = xmlDoc.querySelector('emit xNome')?.textContent || '-';
            const tomador = xmlDoc.querySelector('toma xNome')?.textContent || '-';
            const vISSQN = xmlDoc.querySelector('valores vISSQN')?.textContent || '0.00';
            const vTotalRet = xmlDoc.querySelector('valores vTotalRet')?.textContent || '0.00';
            const vLiq = xmlDoc.querySelector('valores vLiq')?.textContent || '0.00';

            // Detecta o tipo baseado no caminho completo da pasta
            const tipo = detectTipoNota(currentFullPath);

            const situacaoNota = detectSituacaoNota(file, xmlDoc, currentFullPath);
            xmlFiles.push({
              nNFSe,
              serie,
              nDPS,
              dCompet,
              dhEmi,
              prestador,
              tomador,
              vISSQN,
              vTotalRet,
              vLiq,
              tipo,
              situacao: situacaoNota.situacao,
              situacaoOrigem: situacaoNota.origem,
              subtipoEvento: (situacaoNota.situacao === 'manifestacao' && currentFolderName) ? currentFolderName : '',
              pasta: currentFolderName,
              fileName: entry.name
            });
          } else if (recursive && entry.kind === 'directory') {
            const subResult = await readXmlsFromDirectory(entry, true, entry.name, currentFullPath);
            // Suporta retorno antigo (array) e novo (objeto com limitReached)
            if (Array.isArray(subResult)) {
              xmlFiles.push(...subResult);
            } else {
              xmlFiles.push(...subResult.files);
              if (subResult.limitReached) limitReached = true;
            }
          }
        } catch (entryError) {
          // Ignora erros em arquivos individuais e continua
          console.warn(`Erro ao processar ${entry.name}:`, entryError);
        }
      }
    } catch (iterError) {
      console.error('Erro ao iterar pasta:', iterError);
    }

    return { files: xmlFiles, limitReached };
  }

  // Função para listar subpastas de um diretório
  async function listSubfolders(directoryHandle) {
    const folders = [];
    let entriesScanned = 0;
    const MAX_ENTRIES = 10000;

    try {
      for await (const entry of directoryHandle.values()) {
        entriesScanned++;
        if (entriesScanned > MAX_ENTRIES) {
          console.warn(`Limite de ${MAX_ENTRIES} entradas atingido ao listar subpastas`);
          break;
        }

        if (entry.kind === 'directory') {
          folders.push(entry);
        }
      }
    } catch (error) {
      console.error('Erro ao listar subpastas:', error);
    }

    // Ordena por nome
    folders.sort((a, b) => a.name.localeCompare(b.name));
    return folders;
  }

  // Função para mostrar seletor de pastas
  function showFolderSelector(folders, parentName) {
    return new Promise((resolve) => {
      // Cria o overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;

      // Cria o modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 16px;
        max-width: 320px;
        width: 100%;
        max-height: 400px;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      `;

      // Título
      const title = document.createElement('div');
      title.style.cssText = `
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 4px;
        color: #1a1a1a;
      `;
      title.textContent = 'Selecione a pasta';

      // Subtítulo
      const subtitle = document.createElement('div');
      subtitle.style.cssText = `
        font-size: 11px;
        color: #666;
        margin-bottom: 12px;
      `;
      subtitle.textContent = parentName;

      // Lista de pastas
      const list = document.createElement('div');
      list.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
      `;

      // Botão "Todas as pastas"
      const allBtn = document.createElement('button');
      allBtn.style.cssText = `
        padding: 10px 12px;
        border: 1px solid #2563eb;
        background: #eff6ff;
        border-radius: 6px;
        cursor: pointer;
        text-align: left;
        font-size: 12px;
        color: #1a1a1a;
        font-weight: 500;
      `;
      allBtn.textContent = `Todas as pastas (${folders.length})`;
      allBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve('all');
      };
      list.appendChild(allBtn);

      // Separador
      const separator = document.createElement('div');
      separator.style.cssText = `
        height: 1px;
        background: #e5e5e5;
        margin: 6px 0;
      `;
      list.appendChild(separator);

      // Botões para cada pasta
      folders.forEach(folder => {
        const btn = document.createElement('button');
        btn.style.cssText = `
          padding: 10px 12px;
          border: 1px solid #e5e5e5;
          background: #fafafa;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          font-size: 11px;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
        `;
        btn.innerHTML = `<span style="color: #eab308;">&#128193;</span> ${folder.name}`;
        btn.onclick = () => {
          document.body.removeChild(overlay);
          resolve(folder);
        };
        btn.onmouseenter = () => {
          btn.style.background = '#f0f0f0';
          btn.style.borderColor = '#ccc';
        };
        btn.onmouseleave = () => {
          btn.style.background = '#fafafa';
          btn.style.borderColor = '#e5e5e5';
        };
        list.appendChild(btn);
      });

      // Botão cancelar
      const cancelBtn = document.createElement('button');
      cancelBtn.style.cssText = `
        margin-top: 12px;
        padding: 8px;
        border: none;
        background: transparent;
        color: #666;
        cursor: pointer;
        font-size: 11px;
        width: 100%;
      `;
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve(null);
      };

      modal.appendChild(title);
      modal.appendChild(subtitle);
      modal.appendChild(list);
      modal.appendChild(cancelBtn);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Fecha ao clicar fora
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      };
    });
  }

  // Função para gerar relatório a partir de XMLs já selecionados
  async function generateReport(format = 'html') {
    try {
      // Valida permissão da pasta customizada para formatos que salvam arquivo
      if (format !== 'html' && isCustomFolderActive()) {
        try {
          const perm = await _customDirHandle.queryPermission({ mode: 'readwrite' });
          if (perm !== 'granted') {
            showStatus('⚠️ Permissão da pasta expirada. <a href="#" id="linkReauth2" style="color:#2563eb; font-weight:600; text-decoration:underline;">Clique aqui para reautorizar</a>', 'error', true);
            setTimeout(() => { const lnk = document.getElementById('linkReauth2'); if (lnk) lnk.addEventListener('click', (e) => { e.preventDefault(); reauthorizeFolder(); }); }, 50);
            return;
          }
        } catch (err) {
          showStatus('⚠️ Erro ao verificar permissão da pasta: ' + err.message, 'error');
          return;
        }
      }

      // Verifica se há arquivos selecionados
      if (!selectedReportFiles || selectedReportFiles.length === 0) {
        showStatus('⚠️ Selecione uma pasta primeiro!', 'error');
        return;
      }

      // Verifica se o volume de XMLs excede o limite para relatório HTML
      const totalXmls = selectedReportFiles.length;
      if (totalXmls > MAX_XML_FILES_HTML && format === 'html') {
        showStatus(`⚠️ ${totalXmls.toLocaleString('pt-BR')} XMLs encontrado(s). O relatório HTML suporta até ${MAX_XML_FILES_HTML.toLocaleString('pt-BR')}. Apenas os primeiros ${MAX_XML_FILES_HTML.toLocaleString('pt-BR')} serão processados. Para todos os dados, use Excel.`, 'error');
      } else if (totalXmls > 2000 && format === 'html') {
        showStatus(`🔍 Processando ${totalXmls.toLocaleString('pt-BR')} XMLs... Volume alto — se o relatório ficar lento, considere usar Excel.`, 'info');
      } else {
        showStatus('🔍 Processando XMLs...', 'info');
      }

      // Aplica limite apenas para HTML (Excel/CSV suportam volumes maiores)
      let xmlFilesList = selectedReportFiles;
      if (format === 'html' && xmlFilesList.length > MAX_XML_FILES_HTML) {
        xmlFilesList = xmlFilesList.slice(0, MAX_XML_FILES_HTML);
      }

      // Processa XMLs
      const xmlFiles = [];
      const totalFiles = xmlFilesList.length;
      let processedCount = 0;
      for (const file of xmlFilesList) {
        try {
          processedCount++;
          if (totalFiles > 500 && processedCount % 500 === 0) {
            const pct = Math.round((processedCount / totalFiles) * 100);
            showStatus(`🔍 Processando XMLs... ${processedCount.toLocaleString('pt-BR')} de ${totalFiles.toLocaleString('pt-BR')} (${pct}%)`, 'info');
            await new Promise(r => setTimeout(r, 0)); // Libera a UI
          }
          const content = await file.text();
          // Remove namespaces para garantir que querySelector funcione corretamente
          const cleanContent = content.replace(/\sxmlns\s*=\s*"[^"]*"/g, '').replace(/\sxmlns:\w+\s*=\s*"[^"]*"/g, '');
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(cleanContent, 'text/xml');

          // Extrai pasta do caminho (se disponível)
          const folderName = file.webkitRelativePath
            ? file.webkitRelativePath.split('/').slice(-2, -1)[0] || '-'
            : '-';

          xmlFiles.push({
            nNFSe: xmlDoc.querySelector('nNFSe')?.textContent || '-',
            serie: xmlDoc.querySelector('infDPS > serie, serie')?.textContent || '-',
            nDPS: xmlDoc.querySelector('infDPS > nDPS, nDPS')?.textContent || '-',
            cStat: xmlDoc.querySelector('infNFSe cStat')?.textContent ||
              xmlDoc.querySelector('cStat')?.textContent || '-',
            dCompet: xmlDoc.querySelector('dCompet')?.textContent || '-',
            dhEmi: xmlDoc.querySelector('infDPS dhEmi')?.textContent ||
              xmlDoc.querySelector('DPS dhEmi')?.textContent ||
              xmlDoc.querySelector('dhEmi')?.textContent || '-',
            prestadorCnpjCpf: xmlDoc.querySelector('prest CNPJ')?.textContent ||
              xmlDoc.querySelector('prest CPF')?.textContent ||
              xmlDoc.querySelector('emit CNPJ')?.textContent ||
              xmlDoc.querySelector('emit CPF')?.textContent || '-',
            prestador: xmlDoc.querySelector('emit xNome')?.textContent || '-',
            opSimpNac: xmlDoc.querySelector('regTrib opSimpNac')?.textContent ||
              xmlDoc.querySelector('opSimpNac')?.textContent || '-',
            regApTribSN: xmlDoc.querySelector('regTrib regApTribSN')?.textContent ||
              xmlDoc.querySelector('regApTribSN')?.textContent || '-',
            regEspTrib: xmlDoc.querySelector('regTrib regEspTrib')?.textContent ||
              xmlDoc.querySelector('regEspTrib')?.textContent || '-',
            tomadorCnpjCpf: xmlDoc.querySelector('toma CNPJ')?.textContent ||
              xmlDoc.querySelector('toma CPF')?.textContent ||
              xmlDoc.querySelector('toma NIF')?.textContent || '-',
            tomador: xmlDoc.querySelector('toma xNome')?.textContent || '-',
            cTribNac: xmlDoc.querySelector('cServ cTribNac')?.textContent ||
              xmlDoc.querySelector('cTribNac')?.textContent || '-',
            cTribMun: xmlDoc.querySelector('cServ cTribMun')?.textContent ||
              xmlDoc.querySelector('cTribMun')?.textContent || '-',
            xDescServ: xmlDoc.querySelector('cServ xDescServ')?.textContent ||
              xmlDoc.querySelector('xDescServ')?.textContent || '-',
            cNBS: xmlDoc.querySelector('cServ cNBS')?.textContent ||
              xmlDoc.querySelector('cNBS')?.textContent || '-',
            chaveNFSe: (xmlDoc.querySelector('infNFSe')?.getAttribute('Id') || '').replace(/^NFS/, ''),
            xLocIncid: xmlDoc.querySelector('infNFSe xLocIncid')?.textContent ||
              xmlDoc.querySelector('xLocIncid')?.textContent || '-',
            xTribNac: xmlDoc.querySelector('infNFSe xTribNac')?.textContent ||
              xmlDoc.querySelector('xTribNac')?.textContent || '-',
            xTribMun: xmlDoc.querySelector('infNFSe xTribMun')?.textContent ||
              xmlDoc.querySelector('xTribMun')?.textContent || '-',
            xNBS: xmlDoc.querySelector('infNFSe xNBS')?.textContent ||
              xmlDoc.querySelector('xNBS')?.textContent || '-',
            tpRetISSQN: xmlDoc.querySelector('tribMun tpRetISSQN')?.textContent ||
              xmlDoc.querySelector('tpRetISSQN')?.textContent || '-',
            pAliqAplic: xmlDoc.querySelector('valores pAliqAplic')?.textContent ||
              xmlDoc.querySelector('pAliqAplic')?.textContent || '-',
            vISSQN: xmlDoc.querySelector('valores vISSQN')?.textContent || '0.00',
            vBC: xmlDoc.querySelector('valores vBC')?.textContent || '0.00',
            // Tributos Federais - PIS/COFINS
            CST: xmlDoc.querySelector('piscofins CST')?.textContent || '-',
            vBCPisCofins: xmlDoc.querySelector('piscofins vBCPisCofins')?.textContent || '0.00',
            pAliqPis: xmlDoc.querySelector('piscofins pAliqPis')?.textContent || '-',
            pAliqCofins: xmlDoc.querySelector('piscofins pAliqCofins')?.textContent || '-',
            vPis: xmlDoc.querySelector('piscofins vPis')?.textContent || '0.00',
            vCofins: xmlDoc.querySelector('piscofins vCofins')?.textContent || '0.00',
            tpRetPisCofins: xmlDoc.querySelector('piscofins tpRetPisCofins')?.textContent || '-',
            // Tributos Federais - Retenções
            vRetCP: xmlDoc.querySelector('tribFed vRetCP')?.textContent || '0.00',
            vRetIRRF: xmlDoc.querySelector('tribFed vRetIRRF')?.textContent || '0.00',
            vRetCSLL: xmlDoc.querySelector('tribFed vRetCSLL')?.textContent || '0.00',
            vISSQN: xmlDoc.querySelector('valores vISSQN')?.textContent || '0.00',
            vTotalRet: xmlDoc.querySelector('valores vTotalRet')?.textContent || '0.00',
            vLiq: xmlDoc.querySelector('valores vLiq')?.textContent || '0.00',
            vDescIncond: xmlDoc.querySelector('vDescCondIncond vDescIncond')?.textContent ||
              xmlDoc.querySelector('vDescIncond')?.textContent || '0.00',
            vDescCond: xmlDoc.querySelector('vDescCondIncond vDescCond')?.textContent ||
              xmlDoc.querySelector('vDescCond')?.textContent || '0.00',
            pDR: xmlDoc.querySelector('vDedRed pDR')?.textContent || '0.00',
            vDR: xmlDoc.querySelector('vDedRed vDR')?.textContent || '0.00',
            vServ: xmlDoc.querySelector('vServPrest vServ')?.textContent ||
              xmlDoc.querySelector('valores vServ')?.textContent || '0.00',
            tipo: detectTipoNota(file.webkitRelativePath || folderName),
            ...(() => { const r = detectSituacaoNota(file, xmlDoc, file.webkitRelativePath || folderName); return { situacao: r.situacao, situacaoOrigem: r.origem }; })(),
            subtipoEvento: file._subtipoEvento || '',
            pasta: folderName,
            fileName: file.name
          });
        } catch (e) {
          console.warn('[Relatório] Erro ao processar:', file.name, e);
        }
      }

      if (xmlFiles.length === 0) {
        showStatus('❌ Nenhum XML válido encontrado', 'error');
        return;
      }

      // Ordena pelo número da NFSe
      xmlFiles.sort((a, b) => parseInt(a.nNFSe) - parseInt(b.nNFSe));

      // Deduplicação por chave + situação: mesma nota com classificações diferentes é mantida
      // Ex: nota 97 como "Cancelada" + nota 97 como "Manifestação" = ambas mantidas
      // Duplicatas reais (mesma chave E mesma situação) são removidas
      const seenMap = new Map();
      const countFields = (item) => Object.values(item).filter(v => v && v !== '-' && v !== '0.00').length;
      for (const item of xmlFiles) {
        const chave = item.chaveNFSe || item.nNFSe;
        if (chave === '-' || chave === '') continue;
        const key = `${chave}::${item.situacao || 'normal'}`;
        const existing = seenMap.get(key);
        if (!existing || countFields(item) > countFields(existing)) {
          seenMap.set(key, item);
        }
      }
      xmlFiles.length = 0;
      xmlFiles.push(...seenMap.values());
      xmlFiles.sort((a, b) => parseInt(a.nNFSe) - parseInt(b.nNFSe));

      if (format === 'csv') {
        // Gera e baixa o CSV
        const csvContent = generateReportCsv(xmlFiles);
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv; charset=utf-8' }); // BOM para Excel

        // Salva na pasta NFSe/RELATORIOS/
        const nowCsv = new Date();
        const dateCsv = `${String(nowCsv.getDate()).padStart(2, '0')}${String(nowCsv.getMonth() + 1).padStart(2, '0')}${nowCsv.getFullYear()}`;
        const timeCsv = `${String(nowCsv.getHours()).padStart(2, '0')}${String(nowCsv.getMinutes()).padStart(2, '0')}${String(nowCsv.getSeconds()).padStart(2, '0')}`;
        await downloadBlobSmart(blob, `NFSe/RELATORIOS/Relatorio-NFSe ${dateCsv}-${timeCsv}.csv`);

        showStatus(`✅ CSV exportado com ${xmlFiles.length} NFSe(s)`, 'success');
      } else if (format === 'excel') {
        // Gera e baixa o Excel (formato XLSX real)
        showStatus(`📊 Gerando Excel com ${xmlFiles.length.toLocaleString('pt-BR')} NFSe(s)...`, 'info');
        await new Promise(r => setTimeout(r, 0));
        await generateReportExcel(xmlFiles);
        showStatus(`✅ Excel exportado com ${xmlFiles.length.toLocaleString('pt-BR')} NFSe(s)`, 'success');
      } else if (format === 'custom-excel') {
        // Gera Excel Personalizado com campos selecionados (usa os File objects originais)
        await generateCustomExcel(selectedReportFiles);
      } else {
        // Gera o HTML do relatório e abre em nova aba via extensão
        const reportHtml = generateReportHtml(xmlFiles);
        await chrome.storage.local.set({ reportHtml: reportHtml });
        const windowId = await _getTargetWindowId();
        chrome.tabs.create({ url: chrome.runtime.getURL('report.html'), windowId });

        const truncatedMsg = totalXmls > MAX_XML_FILES_HTML ? ` (limitado a ${MAX_XML_FILES_HTML.toLocaleString('pt-BR')} de ${totalXmls.toLocaleString('pt-BR')})` : '';
        showStatus(`✅ Relatório gerado com ${xmlFiles.length} NFSe(s)${truncatedMsg}`, 'success');
      }

    } catch (error) {
      showStatus('❌ Erro ao gerar relatório: ' + error.message, 'error');
      console.error(error);
    }
  }

  // Função para gerar o HTML do relatório
  function generateReportHtml(data) {
    // Calcula os totais
    let totalValorServico = 0;
    let totalValorRetencoes = 0;
    let totalValorLiquido = 0;
    let totalRetCP = 0;
    let totalRetIRRF = 0;
    let totalRetCSLL = 0;
    let totalISSQNRetido = 0;
    let totalPis = 0;
    let totalCofins = 0;
    let totalDescIncond = 0;
    let totalDescCond = 0;
    let totalISSQNNaoRetido = 0;
    let totalPisNaoRetido = 0;
    let totalCofinsNaoRetido = 0;

    // Detecta se prestador ou tomador é único pela CNPJ/CPF (nome pode variar)
    const prestadorDocs = new Set(data.map(i => i.prestadorCnpjCpf).filter(n => n && n !== '-'));
    const tomadorDocs = new Set(data.map(i => i.tomadorCnpjCpf).filter(n => n && n !== '-'));
    const prestadorUnico = prestadorDocs.size === 1;
    const tomadorUnico = tomadorDocs.size === 1;
    // Dados da empresa para o cabeçalho
    const ambosUnicos = prestadorUnico && tomadorUnico;
    let empresaNome = '', empresaCnpj = '', tipoRelatorio = '';
    let prestadorNome = '', prestadorDoc = '', tomadorNome = '', tomadorDoc = '';
    if (ambosUnicos) {
      // Ambos únicos: mostra os dois no cabeçalho, sem classificar
      prestadorNome = data.find(i => i.prestador && i.prestador !== '-')?.prestador || '';
      prestadorDoc = data.find(i => i.prestadorCnpjCpf && i.prestadorCnpjCpf !== '-')?.prestadorCnpjCpf || '';
      tomadorNome = data.find(i => i.tomador && i.tomador !== '-')?.tomador || '';
      tomadorDoc = data.find(i => i.tomadorCnpjCpf && i.tomadorCnpjCpf !== '-')?.tomadorCnpjCpf || '';
    } else if (prestadorUnico) {
      empresaCnpj = data.find(i => i.prestadorCnpjCpf && i.prestadorCnpjCpf !== '-')?.prestadorCnpjCpf || '';
      empresaNome = data.find(i => i.prestador && i.prestador !== '-')?.prestador || '';
      tipoRelatorio = 'Notas Emitidas';
    } else if (tomadorUnico) {
      empresaCnpj = data.find(i => i.tomadorCnpjCpf && i.tomadorCnpjCpf !== '-')?.tomadorCnpjCpf || '';
      empresaNome = data.find(i => i.tomador && i.tomador !== '-')?.tomador || '';
      tipoRelatorio = 'Notas Recebidas';
    }

    // Função para converter código tpRetISSQN em descrição
    const getTipoRetencaoISSQN = (codigo) => {
      switch (codigo) {
        case '1': return '1 - Não Retido';
        case '2': return '2 - Retido pelo Tomador';
        case '3': return '3 - Retido pelo Intermediário';
        default: return '-';
      }
    };

    const _cstMap = {
      '00': 'Nenhum',
      '01': 'Operação Tributável com Alíquota Básica',
      '02': 'Operação Tributável com Alíquota Diferenciada',
      '03': 'Operação Tributável com Alíquota por Unidade de Medida de Produto',
      '04': 'Operação Tributável Monofásica - Revenda a Alíquota Zero',
      '05': 'Operação Tributável por Substituição Tributária',
      '06': 'Operação Tributável a Alíquota Zero',
      '07': 'Operação Isenta da Contribuição',
      '08': 'Operação sem Incidência da Contribuição',
      '09': 'Operação com Suspensão da Contribuição',
      '49': 'Outras Operações de Saída',
      '50': 'Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno',
      '51': 'Direito a Crédito - Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno',
      '52': 'Direito a Crédito - Vinculada Exclusivamente a Receita de Exportação',
      '53': 'Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno',
      '54': 'Direito a Crédito - Vinculada a Receitas Tributadas no Mercado Interno e de Exportação',
      '55': 'Direito a Crédito - Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação',
      '56': 'Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação',
      '60': 'Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno',
      '61': 'Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno',
      '62': 'Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita de Exportação',
      '63': 'Crédito Presumido - Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno',
      '64': 'Crédito Presumido - Aquisição Vinculada a Receitas Tributadas no Mercado Interno e de Exportação',
      '65': 'Crédito Presumido - Aquisição Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação',
      '66': 'Crédito Presumido - Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação',
      '67': 'Crédito Presumido - Outras Operações',
      '70': 'Operação de Aquisição sem Direito a Crédito',
      '71': 'Operação de Aquisição com Isenção',
      '72': 'Operação de Aquisição com Suspensão',
      '73': 'Operação de Aquisição a Alíquota Zero',
      '74': 'Operação de Aquisição sem Incidência da Contribuição',
      '75': 'Operação de Aquisição por Substituição Tributária',
      '98': 'Outras Operações de Entrada',
      '99': 'Outras Operações'
    };

    const getCSTPisCofins = (codigo) => {
      const desc = _cstMap[codigo];
      return desc ? `${codigo} - ${desc}` : (codigo && codigo !== '-' ? codigo : '-');
    };

    const getTipoRetPisCofins = (codigo) => {
      switch (codigo) {
        case '0': return '0 - PIS/COFINS/CSLL Não Retidos';
        case '1': return '1 - PIS/COFINS Retido';
        case '2': return '2 - PIS/COFINS Não Retido';
        case '3': return '3 - PIS/COFINS/CSLL Retidos';
        case '4': return '4 - PIS/COFINS Retidos, CSLL Não Retido';
        case '5': return '5 - PIS Retido, COFINS/CSLL Não Retido';
        case '6': return '6 - COFINS Retido, PIS/CSLL Não Retido';
        case '7': return '7 - PIS Não Retido, COFINS/CSLL Retidos';
        case '8': return '8 - PIS/COFINS Não Retidos, CSLL Retido';
        case '9': return '9 - COFINS Não Retido, PIS/CSLL Retidos';
        default: return '-';
      }
    };

    // Verifica se há tipos diferentes para mostrar a coluna
    const hasMultipleTipos = new Set(data.map(d => d.tipo)).size > 1 || data.some(d => d.tipo !== '-');

    const rows = data.map((item) => {
      const vServ = parseFloat(item.vServ) || 0;
      const vTotalRet = parseFloat(item.vTotalRet) || 0;
      const vLiq = parseFloat(item.vLiq) || 0;
      const vRetCP = parseFloat(item.vRetCP) || 0;
      const vRetIRRF = parseFloat(item.vRetIRRF) || 0;
      const vRetCSLL = parseFloat(item.vRetCSLL) || 0;
      const vISSQN = parseFloat(item.vISSQN) || 0;
      const vBC = parseFloat(item.vBC) || 0;
      const vBCPisCofins = parseFloat(item.vBCPisCofins) || 0;
      const vPis = parseFloat(item.vPis) || 0;
      const vCofins = parseFloat(item.vCofins) || 0;
      const vDescIncond = parseFloat(item.vDescIncond) || 0;
      const vDescCond = parseFloat(item.vDescCond) || 0;
      const pDR = parseFloat(item.pDR) || 0;
      const vDR = parseFloat(item.vDR) || 0;

      // Soma totais apenas de notas normais (cancelada/substituída ficam ocultas por padrão)
      const isNormal = (item.situacao || 'normal') === 'normal';
      if (isNormal) {
        totalValorServico += vServ;
        totalValorRetencoes += vTotalRet;
        totalValorLiquido += vLiq;
        totalRetCP += vRetCP;
        totalRetIRRF += vRetIRRF;
        totalRetCSLL += vRetCSLL;
        totalDescIncond += vDescIncond;
        totalDescCond += vDescCond;
      }
      // Soma PIS/COFINS e ISSQN apenas de notas normais
      if (isNormal) {
        // PIS Retido: 1,3,4,5,9
        if (['1','3','4','5','9'].includes(item.tpRetPisCofins)) {
          totalPis += vPis;
        }
        // COFINS Retido: 1,3,4,6,7
        if (['1','3','4','6','7'].includes(item.tpRetPisCofins)) {
          totalCofins += vCofins;
        }
        if (item.tpRetISSQN === '2') {
          totalISSQNRetido += vISSQN;
        }
        // Soma impostos NÃO retidos (inversa exata da retenção)
        if (item.tpRetISSQN !== '2') {
          totalISSQNNaoRetido += vISSQN;
        }
        // PIS Não Retido: 0,2,6,7,8
        if (['0','2','6','7','8'].includes(item.tpRetPisCofins) || !['0','1','2','3','4','5','6','7','8','9'].includes(item.tpRetPisCofins)) {
          totalPisNaoRetido += vPis;
        }
        // COFINS Não Retido: 0,2,5,8,9
        if (['0','2','5','8','9'].includes(item.tpRetPisCofins) || !['0','1','2','3','4','5','6','7','8','9'].includes(item.tpRetPisCofins)) {
          totalCofinsNaoRetido += vCofins;
        }
      }

      const tipoCell = hasMultipleTipos ? `<td class="tipo-cell ${item.tipo === 'Emitida' ? 'tipo-emitida' : item.tipo === 'Recebida' ? 'tipo-recebida' : ''}">${item.tipo}</td>` : '';

      // Calcula flags para filtros
      const compFormatted = formatDateTime(item.dCompet);
      const emiFormatted = formatDateTime(item.dhEmi);
      const isCompDiff = compFormatted !== emiFormatted ? '1' : '0';
      const isISSQNRetido = item.tpRetISSQN === '2' ? '1' : '0';
      // PIS retido em qualquer combinação: 1,3,4,5,9
      const isPisRetido = ['1','3','4','5','9'].includes(item.tpRetPisCofins) ? '1' : '0';
      const hasRetencoes = (vRetCP !== 0 || vRetIRRF !== 0 || vRetCSLL !== 0) ? '1' : '0';

      // PIS/COFINS retidos condicionalmente para recalcular nos filtros
      const pisRetido = ['1','3','4','5','9'].includes(item.tpRetPisCofins) ? vPis : 0;
      const cofinsRetido = ['1','3','4','6','7'].includes(item.tpRetPisCofins) ? vCofins : 0;
      const issqnRetido = item.tpRetISSQN === '2' ? vISSQN : 0;
      // Valores NÃO retidos (inversa exata da retenção)
      const pisNaoRetido = !['1','3','4','5','9'].includes(item.tpRetPisCofins) ? vPis : 0;
      const cofinsNaoRetido = !['1','3','4','6','7'].includes(item.tpRetPisCofins) ? vCofins : 0;
      const issqnNaoRetido = item.tpRetISSQN !== '2' ? vISSQN : 0;

      // Extrai mês/ano da competência e emissão para filtro por mês
      const monthCompet = (() => {
        if (!item.dCompet || item.dCompet === '-') return '';
        const match = item.dCompet.match(/(\d{4})-(\d{2})/);
        return match ? `${match[2]}/${match[1]}` : '';
      })();
      const monthEmi = (() => {
        if (!item.dhEmi || item.dhEmi === '-') return '';
        const match = item.dhEmi.match(/(\d{4})-(\d{2})/);
        return match ? `${match[2]}/${match[1]}` : '';
      })();

      const situacao = item.situacao || 'normal';
      const subtipoEvento = item.subtipoEvento || '';
      const situacaoOrigem = item.situacaoOrigem || '';
      const origemIcon = situacaoOrigem === 'pasta'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;opacity:0.7;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
        : situacaoOrigem === 'xml'
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;opacity:0.7;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>'
          : '';
      const svgCancelada = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 11 11" style="vertical-align:middle;margin-right:3px;"><circle cx="5.5" cy="5.5" r="5.5" fill="#de0a0a"/><path d="M10.428,5.543,9.885,5,7.714,7.171,5.543,5,5,5.543,7.171,7.714,5,9.885l.543.543L7.714,8.257l2.171,2.171.543-.543L8.257,7.714Z" transform="translate(-2.214 -2.214)" fill="#fff" stroke="#fff" stroke-width="0.5" fill-rule="evenodd"/></svg>';
      const svgSubstituida = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 11 11" style="vertical-align:middle;margin-right:3px;"><circle cx="5.5" cy="5.5" r="5.5" fill="#bc00ff"/><g transform="translate(2.806 8.175) rotate(-90)"><line x2="5.645" transform="translate(0 1.161)" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1"/><path d="M4050.5,5287.5l1.374,1.137-1.374,1.165" transform="translate(-4046.209 -5287.5)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1"/></g><line x1="5.645" transform="translate(7.142 8.348) rotate(-90)" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1"/><path d="M0,0,1.374,1.137,0,2.3" transform="translate(8.302 6.993) rotate(90)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1"/></svg>';
      const situacaoBadge = situacao === 'cancelada'
        ? `<span class="situacao-badge situacao-cancelada">${origemIcon}Cancelada</span>`
        : situacao === 'substituida'
          ? `<span class="situacao-badge situacao-substituida">${origemIcon}Substituída</span>`
          : situacao === 'manifestacao'
            ? (() => {
                const subLower = (subtipoEvento || '').toLowerCase();
                const manifestClass = subLower.includes('cancelada') || subLower.includes('cancelamento')
                  ? 'situacao-cancelada'
                  : subLower.includes('substituida') || subLower.includes('substituída') || subLower.includes('substituicao') || subLower.includes('substituição')
                    ? 'situacao-substituida'
                    : 'situacao-manifestacao';
                return `<span class="situacao-badge ${manifestClass}">${origemIcon}Manifestação${subtipoEvento ? ' - ' + subtipoEvento : ''}</span>`;
              })()
            : '';

      const hiddenStyle = ''; // Todas as notas visíveis por padrão

      return `
      <tr data-nfse="${item.nNFSe}" data-dcompet="${item.dCompet || ''}" data-comp-diff="${isCompDiff}" data-issqn-ret="${isISSQNRetido}" data-pis-ret="${isPisRetido}" data-ret-cp="${hasRetencoes}" data-vserv="${vServ}" data-vtotalret="${vTotalRet}" data-vliq="${vLiq}" data-vretcp="${vRetCP}" data-vretirrf="${vRetIRRF}" data-vretcsll="${vRetCSLL}" data-vpiscofins="${pisRetido + cofinsRetido}" data-vissqnret="${issqnRetido}" data-vpiscofinsnaor="${pisNaoRetido + cofinsNaoRetido}" data-vissqnnaor="${issqnNaoRetido}" data-vdescincond="${vDescIncond}" data-vdesccond="${vDescCond}" data-month-compet="${monthCompet}" data-month-emi="${monthEmi}" data-situacao="${situacao}"${hiddenStyle}>
        ${tipoCell}
        <td style="text-align:center;padding:0 2px;"><a href="https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${item.chaveNFSe}" target="_blank" title="Consultar NFSe" style="text-decoration:none;">&#x1F50D;</a></td>
        <td style="text-align:left;">${item.nNFSe}${situacaoBadge ? '<br>' + situacaoBadge : ''}</td>
        <td style="text-align:left;">${(() => {
          const comp = compFormatted;
          const emi = emiFormatted;
          const isDiff = comp !== emi;
          if (isDiff) {
            return `<div><span style="color:#dc2626;">${comp}</span></div><div>${emi}</div>`;
          }
          return `<div>${comp}</div>`;
        })()}</td>
        <td style="text-align:left;">${ambosUnicos
          ? `<div class="nome-prestador" title="${item.prestador}">${item.prestador}</div><div class="nome-tomador" title="${item.tomador}">${item.tomador}</div>`
          : prestadorUnico
            ? `<div class="nome-tomador" title="${item.tomador}">${item.tomador}</div>`
            : tomadorUnico
              ? `<div class="nome-prestador" title="${item.prestador}">${item.prestador}</div>`
              : `<div class="nome-prestador" title="${item.prestador}">${item.prestador}</div><div class="nome-tomador" title="${item.tomador}">${item.tomador}</div>`
        }</td>
        ${(() => {
          const pAliq = item.pAliqAplic !== '-' ? parseFloat(item.pAliqAplic) : 0;
          const hasISSQN = vBC !== 0 || pAliq !== 0 || vISSQN !== 0;
          const hasLoc = item.xLocIncid && item.xLocIncid !== '-';
          const retIssDesc = getTipoRetencaoISSQN(item.tpRetISSQN);
          const isRetido = item.tpRetISSQN === '2' || item.tpRetISSQN === '3';
          const badge = hasISSQN && item.tpRetISSQN && item.tpRetISSQN !== '-'
            ? (isRetido
              ? `<span title="${retIssDesc}" style="color:#dc2626;cursor:help;border-bottom:1px dotted #dc2626;">${item.tpRetISSQN}</span>`
              : `<span title="${retIssDesc}" style="cursor:help;border-bottom:1px dotted #666666;">${item.tpRetISSQN}</span>`)
            : '-';
          const hasTribNac = item.cTribNac && item.cTribNac !== '-';
          const hasCNBS = item.cNBS && item.cNBS !== '-';
          return `<td class="nome-local" style="text-align:left;"><div>${hasLoc ? item.xLocIncid : '-'}</div>${hasTribNac ? `<div><span title="${item.xTribNac || ''}" style="cursor:help;border-bottom:1px dotted #aaa;">${item.cTribNac}</span></div>` : ''}${hasCNBS ? `<div><span title="${item.xNBS || ''}" style="cursor:help;border-bottom:1px dotted #aaa;">${item.cNBS}</span></div>` : ''}</td><td>${badge}</td><td class="currency">${hasISSQN ? pAliq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '-'}</td><td class="currency">${hasISSQN ? (isRetido ? `<span style="color:#dc2626;">${vISSQN.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : vISSQN.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '-'}</td>`;
        })()}
        ${(() => {
          const pPis = item.pAliqPis !== '-' ? parseFloat(item.pAliqPis) : 0;
          const pCofins = item.pAliqCofins !== '-' ? parseFloat(item.pAliqCofins) : 0;
          const hasPisCofins = vBCPisCofins !== 0 || pPis !== 0 || pCofins !== 0 || vPis !== 0 || vCofins !== 0;
          const retPisDesc = getTipoRetPisCofins(item.tpRetPisCofins);
          const isRetidoPis = ['1','3','4','5','6','7','8','9'].includes(item.tpRetPisCofins);
          const badgePis = !hasPisCofins ? '-' : (item.tpRetPisCofins && item.tpRetPisCofins !== '-'
            ? (isRetidoPis
              ? `<span title="${retPisDesc}" style="color:#dc2626;cursor:help;border-bottom:1px dotted #dc2626;">${item.tpRetPisCofins}</span>`
              : `<span title="${retPisDesc}" style="cursor:help;border-bottom:1px dotted #666666;">${item.tpRetPisCofins}</span>`)
            : '-');
          const cstDesc = _cstMap[item.CST] || '';
          const cstLabel = !hasPisCofins ? '-' : (item.CST && item.CST !== '-' ? `<span title="${cstDesc}" style="cursor:help;border-bottom:1px dotted #666666;">${item.CST}</span>` : '-');
          return `<td>${badgePis}</td><td>${cstLabel}</td><td class="currency">${hasPisCofins ? vPis.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td><td class="currency">${hasPisCofins ? vCofins.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>`;
        })()}
        <td class="currency">${vRetCP !== 0 ? `<span style="color:#dc2626;">${vRetCP.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : '-'}</td>
        <td class="currency">${vRetIRRF !== 0 ? `<span style="color:#dc2626;">${vRetIRRF.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : '-'}</td>
        <td class="currency">${vRetCSLL !== 0 ? `<span style="color:#dc2626;">${vRetCSLL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : '-'}</td>
        <td class="currency">${(() => {
          const hasAny = vDescIncond !== 0 || vDescCond !== 0 || vDR !== 0;
          if (!hasAny) return '-';
          const lines = [];
          lines.push(vDescIncond !== 0 ? vDescIncond.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');
          lines.push(vDescCond !== 0 ? vDescCond.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');
          lines.push(vDR !== 0 ? vDR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');
          return lines.map(l => `<div>${l}</div>`).join('');
        })()}</td>
        <td class="currency"><div>${vServ.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>${vLiq !== vServ ? `<div style="color:#dc2626;">${vLiq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}</td>
      </tr>
    `;
    }).join('');

    const tipoHeader = hasMultipleTipos ? '<th class="tipo-header">Tipo</th>' : '';
    const tipoFooter = hasMultipleTipos ? '<td></td>' : '';

    // Conta notas para cada filtro
    let countCompDiff = 0, countISSQNRet = 0, countPisRet = 0, countRetCPIRRFCSLL = 0;
    let countOutrasSituacoes = 0; // cancelada + substituída + manifestação
    let countNormais = 0; // notas normais (sem eventos)
    const monthsSet = new Set();
    data.forEach(item => {
      const comp = formatDateTime(item.dCompet);
      const emi = formatDateTime(item.dhEmi);
      if (comp !== emi) countCompDiff++;
      if (item.tpRetISSQN === '2') countISSQNRet++;
      if (['1','3','4','5','6','7','8','9'].includes(item.tpRetPisCofins)) countPisRet++;
      const vRC = parseFloat(item.vRetCP) || 0;
      const vRI = parseFloat(item.vRetIRRF) || 0;
      const vRCS = parseFloat(item.vRetCSLL) || 0;
      if (vRC !== 0 || vRI !== 0 || vRCS !== 0) countRetCPIRRFCSLL++;
      // Conta situações especiais (cancelada + substituída + manifestação)
      if (item.situacao === 'cancelada' || item.situacao === 'substituida' || item.situacao === 'manifestacao') {
        countOutrasSituacoes++;
      } else {
        countNormais++;
      }
      // Coleta meses únicos de competência
      if (item.dCompet && item.dCompet !== '-') {
        const match = item.dCompet.match(/(\d{4})-(\d{2})/);
        if (match) monthsSet.add(`${match[2]}/${match[1]}`);
      }
    });

    // Gera options do select de meses (ordenados)
    const monthNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthsArray = Array.from(monthsSet).sort((a, b) => {
      const [mA, yA] = a.split('/').map(Number);
      const [mB, yB] = b.split('/').map(Number);
      return yA !== yB ? yA - yB : mA - mB;
    });
    const monthOptions = monthsArray.map(m => {
      const [mm, yyyy] = m.split('/');
      const label = `Somente ${monthNames[parseInt(mm)]}/${yyyy}`;
      return `<option value="${m}">${label}</option>`;
    }).join('');
    const hasMultipleMonths = monthsArray.length > 1;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório NFSe</title>
  <link rel="stylesheet" href="fonts/inter.css">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 30px;
      background: #f5f5f5;
      color: #333333;
    }

    .container {
      max-width: 100%;
      margin: 0 auto;
      background: #ffffff;
      padding: 25px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow-x: auto;
    }

    h1 {
      color: #000000;
      margin-bottom: 10px;
      font-size: 22px;
    }

    .subtitle {
      color: #666666;
      margin-bottom: 20px;
      font-size: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      table-layout: auto;
    }

    thead {
      background: #ffffff;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
    }

    th {
      padding: 10px 8px;
      text-align: center;
      font-weight: 700;
      font-size: 11px;
      color: #000000;
      vertical-align: top;
      line-height: 1.4;
      white-space: nowrap;
      text-transform: uppercase;
    }

    th span {
      text-transform: none;
      color: #666666;
    }

    .tipo-header {
      width: 80px;
    }

    .tipo-cell {
      font-weight: 500;
      font-size: 11px;
    }

    .tipo-emitida {
      color: #000000;
      background: #f5f5f5;
    }

    .tipo-recebida {
      color: #666666;
      background: #f5f5f5;
    }

    td {
      padding: 8px 8px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
      color: #333333;
      vertical-align: middle;
      line-height: 1.5;
      text-align: center;
    }

    td div + div {
      margin-top: 2px;
    }

    .nome-prestador, .nome-tomador {
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nome-local {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    td:first-child {
      text-align: center;
      font-weight: 500;
    }

    tbody tr:nth-child(even) {
      background: #f5f5f5;
    }

    tbody tr:hover {
      background: #fefce8;
    }

    .currency {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    tfoot {
      background: #f5f5f5;
      font-weight: 600;
      border-top: 2px solid #000000;
    }

    tfoot td {
      padding: 12px 8px;
      font-size: 11px;
      color: #000000;
    }

    .summary-box {
      margin-top: 15px;
      background: #f5f5f5;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 12px;
    }

    .summary-title {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e5e5;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .summary-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .summary-item {
      background: #ffffff;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #e5e5e5;
      text-align: center;
    }

    .summary-label {
      font-size: 10px;
      color: #000000;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .summary-label span {
      text-transform: none;
      font-weight: 400;
      color: #666666;
    }

    .summary-value {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      font-variant-numeric: tabular-nums;
    }

    .summary-value.positive {
      color: #000000;
    }

    .summary-value.negative {
      color: #dc2626;
    }

    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
      padding: 12px 15px;
      background: #f5f5f5;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
    }

    .filters-bar label {
      font-size: 12px;
      font-weight: 600;
      color: #333333;
      margin-right: 4px;
    }

    .filter-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      font-size: 11px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      color: #333333;
      background: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      cursor: pointer;
      transition: none;
      user-select: none;
    }

    .filter-btn:hover:not(:disabled) {
      background: #000000;
      color: #ffffff;
      border-color: #000000;
    }

    .filter-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .filter-btn.active {
      background: #000000;
      color: #ffffff;
      border-color: #000000;
    }

    .filter-btn .filter-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 9px;
      background: #e5e5e5;
      color: #333333;
    }

    .filter-btn.active .filter-count {
      background: rgba(255,255,255,0.2);
      color: #ffffff;
    }

    .filter-info {
      margin-left: auto;
      font-size: 11px;
      color: #666666;
    }

    .situacao-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.3px;
      margin-top: 2px;
    }

    .situacao-cancelada {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .situacao-substituida {
      background: #f5f0ff;
      color: #7c00cc;
      border: 1px solid #d8b4fe;
    }

    .situacao-manifestacao {
      background: #fefce8;
      color: #a16207;
      border: 1px solid #fde68a;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .header-buttons {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 12px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      color: #475569;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      cursor: pointer;
      transition: none;
      flex-shrink: 0;
    }

    .btn-action:hover {
      background: #1e293b;
      color: white;
      border-color: #1e293b;
    }


    @page {
      margin: 10mm;
    }

    @media print {
      body {
        padding: 0;
        background: white;
      }
      .container {
        box-shadow: none;
        padding: 0;
      }
      .filters-bar {
        display: none;
      }
      .header-buttons {
        display: none;
      }
      .header-row {
        margin-bottom: 5px;
      }
      h1 {
        font-size: 16px;
        margin-bottom: 4px;
      }
      .subtitle {
        font-size: 10px;
        margin-bottom: 8px;
      }
      table {
        margin-top: 8px;
      }
      th {
        padding: 4px 3px;
        font-size: 9px;
      }
      th span {
        font-size: 7px !important;
      }
      td {
        padding: 3px 3px;
        font-size: 9px;
        line-height: 1.3;
      }
      .nome-prestador, .nome-tomador {
        max-width: 150px;
        font-size: 8px;
      }
      tfoot td {
        padding: 4px 3px;
        font-size: 9px;
      }
      .summary-section {
        break-before: page;
        page-break-before: always;
      }
      .summary-box {
        break-inside: avoid;
        page-break-inside: avoid;
        padding: 8px;
        margin-top: 8px;
      }
      .summary-box + .summary-box {
        margin-top: 8px;
      }
      .summary-title {
        font-size: 9px;
        margin-bottom: 6px;
        padding-bottom: 4px;
      }
      .summary-grid, .summary-grid-4 {
        gap: 6px;
      }
      .summary-item {
        padding: 6px;
      }
      .summary-label {
        font-size: 8px;
      }
      .summary-value {
        font-size: 9px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <div>
        <h1>Relatório de NFSe${tipoRelatorio ? ` — ${tipoRelatorio}` : ''}</h1>
        ${ambosUnicos ? `
          <div style="font-size:12px;margin:4px 0 2px;line-height:1.6;">
            <div><span style="font-weight:600;color:#1a1a1a;">Prestador:</span> ${prestadorNome}${prestadorDoc ? ` <span style="color:#64748b;font-size:11px;">· ${prestadorDoc}</span>` : ''}</div>
            <div><span style="font-weight:600;color:#1a1a1a;">Tomador:</span> ${tomadorNome}${tomadorDoc ? ` <span style="color:#64748b;font-size:11px;">· ${tomadorDoc}</span>` : ''}</div>
          </div>
        ` : empresaNome ? `<div style="font-size:13px;font-weight:600;color:#1a1a1a;margin:2px 0;">${empresaNome}${empresaCnpj ? ` <span style="font-weight:400;color:#64748b;font-size:11px;">· ${empresaCnpj}</span>` : ''}</div>` : ''}
        <div class="subtitle">
          Total de ${data.length} nota(s) fiscal(is) | Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
        </div>
      </div>
      <div class="header-buttons">
        <button class="btn-action" id="btnPrint" title="Imprimir">&#128424; Imprimir</button>
      </div>
    </div>

    <div class="filters-bar">
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;">
        <label>Retenções:</label>
        <button class="filter-btn" data-filter="issqn-ret"${countISSQNRet === 0 ? ' disabled' : ''}>
          ISSQN Retido <span class="filter-count">${countISSQNRet}</span>
        </button>
        <button class="filter-btn" data-filter="pis-ret"${countPisRet === 0 ? ' disabled' : ''}>
          PIS/COFINS Retido <span class="filter-count">${countPisRet}</span>
        </button>
        <button class="filter-btn" data-filter="ret-cp"${countRetCPIRRFCSLL === 0 ? ' disabled' : ''}>
          Retenções CP/IRRF/CSLL <span class="filter-count">${countRetCPIRRFCSLL}</span>
        </button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;padding-top:8px;border-top:1px solid #e2e8f0;">
        <label>Filtros:</label>
        <button class="filter-btn" data-filter="comp-diff"${countCompDiff === 0 ? ' disabled' : ''}>
          Competência ≠ Emissão <span class="filter-count">${countCompDiff}</span>
        </button>
        ${countOutrasSituacoes > 0 ? `
        <button class="filter-btn" data-filter="outras-situacoes">
          Cancelada / Substituída / Manifestação <span class="filter-count">${countOutrasSituacoes}</span>
        </button>
        <button class="filter-btn" data-filter="somente-nfse"${countNormais === 0 ? ' disabled' : ''}>
          Sem Eventos <span class="filter-count">${countNormais}</span>
        </button>` : ''}
        ${hasMultipleMonths ? `
        <span style="display:inline-flex;align-items:center;gap:4px;">
          <label style="font-size:11px;font-weight:500;color:#555;white-space:nowrap;">Mês:</label>
          <select id="monthFilter" style="padding:5px 10px;font-size:11px;font-family:'Inter',sans-serif;font-weight:500;color:#333333;background:#ffffff;border:1px solid #e5e5e5;border-radius:6px;cursor:pointer;">
            <option value="">Todos os meses</option>
            ${monthOptions}
          </select>
          <label style="font-size:11px;font-weight:500;color:#555;white-space:nowrap;">por:</label>
          <select id="monthFilterType" style="padding:5px 10px;font-size:11px;font-family:'Inter',sans-serif;font-weight:500;color:#333333;background:#ffffff;border:1px solid #e5e5e5;border-radius:6px;cursor:pointer;">
            <option value="compet">Competência</option>
            <option value="emi">Emissão</option>
          </select>
        </span>
        ` : ''}
        <span class="filter-info" id="filterInfo"></span>
        <span style="margin-left:auto;display:flex;align-items:center;gap:4px;">
          <label for="sortSelect" style="white-space:nowrap;">Ordenar:</label>
          <select id="sortSelect" style="padding:5px 8px;font-size:12px;font-family:'Inter',sans-serif;font-weight:600;color:#333333;background:#ffffff;border:1px solid #e5e5e5;border-radius:6px;cursor:pointer;">
            <option value="nfse-asc">nNFSe ↑</option>
            <option value="nfse-desc">nNFSe ↓</option>
            <option value="dcompet-asc">dCompet ↑</option>
            <option value="dcompet-desc">dCompet ↓</option>
          </select>
        </span>
      </div>
    </div>

    <table id="reportTable">
      <thead>
        <tr>
          ${tipoHeader}
          <th style="width:20px;"></th>
          <th style="text-align:left;">NOTA<br><span style="font-weight:400;font-size:9px;">nNFSe</span></th>
          <th style="text-align:left;">DATAS<br><span style="font-weight:400;font-size:9px;">dCompet<br>dhEmi</span></th>
          <th style="text-align:left;">${ambosUnicos
            ? `PRESTADOR | TOMADOR<br><span style="font-weight:400;font-size:9px;">xNome</span>`
            : prestadorUnico
              ? `TOMADOR<br><span style="font-weight:400;font-size:9px;">xNome</span>`
              : tomadorUnico
                ? `PRESTADOR<br><span style="font-weight:400;font-size:9px;">xNome</span>`
                : `PRESTADOR | TOMADOR<br><span style="font-weight:400;font-size:9px;">xNome</span>`
          }</th>
          <th style="text-align:left;">Local / Serviço<br><span style="font-weight:400;font-size:9px;">xLocIncid<br>cTribNac<br>cNBS</span></th>
          <th>tpRet<br><span style="font-weight:400;font-size:9px;">ISSQN</span></th>
          <th>Alíq<br><span style="font-weight:400;font-size:9px;">pAliq</span></th>
          <th>ISSQN<br><span style="font-weight:400;font-size:9px;">vISSQN</span></th>
          <th>tpRet<br><span style="font-weight:400;font-size:9px;">PisCofins</span></th>
          <th>CST<br><span style="font-weight:400;font-size:9px;">PisCofins</span></th>
          <th>PIS<br><span style="font-weight:400;font-size:9px;">vPis</span></th>
          <th>COFINS<br><span style="font-weight:400;font-size:9px;">vCofins</span></th>
          <th>CP<br><span style="font-weight:400;font-size:9px;">vRetCP</span></th>
          <th>IRRF<br><span style="font-weight:400;font-size:9px;">vRetIRRF</span></th>
          <th>CSLL<br><span style="font-weight:400;font-size:9px;">vRetCSLL</span></th>
          <th class="currency">Desc/Ded/Red<br><span style="font-weight:400;font-size:9px;">vDescIncond<br>vDescCond<br>vDR</span></th>
          <th class="currency">Serviço<br><span style="font-weight:400;font-size:9px;">vServ<br>vLiq</span></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          ${tipoFooter}
          <td colspan="16"></td>
          <td class="currency" style="font-weight: 700;">${totalValorServico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>

    <div class="summary-section" style="page-break-before: always; break-before: page;">
    <div class="summary-box">
      <div class="summary-title">Resumo de Totais</div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">Valor Serviço<br><span>(vServ)</span></div>
          <div class="summary-value" id="sumVServ">R$ ${totalValorServico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Valor Total Retenções<br><span>(vTotalRet)</span></div>
          <div class="summary-value negative" id="sumVTotalRet">R$ ${totalValorRetencoes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Descontos<br><span>(vDescIncond + vDescCond)</span></div>
          <div class="summary-value negative" id="sumDescontos">R$ ${(totalDescIncond + totalDescCond).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Valor Líquido<br><span>(vLiq)</span></div>
          <div class="summary-value positive" id="sumVLiq">R$ ${totalValorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>

    <div class="summary-box">
      <div class="summary-title">Resumo de Retenções</div>
      <div class="summary-grid-4">
        <div class="summary-item">
          <div class="summary-label">Retenção CP<br><span>(vRetCP)</span></div>
          <div class="summary-value negative" id="sumRetCP">R$ ${totalRetCP.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Retenção IRRF<br><span>(vRetIRRF)</span></div>
          <div class="summary-value negative" id="sumRetIRRF">R$ ${totalRetIRRF.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Retenção PIS/COFINS/CSLL<br><span>(vRetCSLL)</span></div>
          <div class="summary-value negative" id="sumRetPisCofinsCSLL">R$ ${totalRetCSLL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Retenção ISSQN<br><span>(vISSQN)</span></div>
          <div class="summary-value negative" id="sumISSQN">R$ ${totalISSQNRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>

    <div class="summary-box">
      <div class="summary-title">Resumo de Impostos</div>
      <div class="summary-grid-4">
        <div class="summary-item">
          <div class="summary-label">ISSQN Não Retido<br><span>(vISSQN)</span></div>
          <div class="summary-value" id="sumISSQNNaoRetido">R$ ${totalISSQNNaoRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">PIS/COFINS Operação Própria<br><span>(vPis + vCofins)</span></div>
          <div class="summary-value" id="sumPisCofinsOp">R$ ${(totalPis + totalPisNaoRetido + totalCofins + totalCofinsNaoRetido).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
    </div>

  </div>

</body>
</html>
    `;
  }

  // Função para gerar CSV do relatório
  function generateReportCsv(data) {
    // Cabeçalho do CSV
    const headers = ['NFSe', 'DPS', 'Data de Competencia', 'Data da Geracao', 'Prestador', 'Tomador', 'ISS Retido', 'Valor Total'];

    // Função para escapar valores CSV (trata aspas e vírgulas)
    const escapeCsv = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    // Formata data para o CSV
    const formatDateCsv = (dateTimeStr) => {
      if (!dateTimeStr || dateTimeStr === '-') return '';
      try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateTimeStr)) {
          const [year, month, day] = dateTimeStr.split('-');
          return `${day}/${month}/${year}`;
        }
        const date = new Date(dateTimeStr);
        return date.toLocaleDateString('pt-BR');
      } catch (e) {
        return dateTimeStr;
      }
    };

    // Gera as linhas de dados
    const rows = data.map(item => {
      const vISSRetido = parseFloat(item.vISSQN) || 0;
      const vTotalRet = parseFloat(item.vTotalRet) || 0;
      const vLiq = parseFloat(item.vLiq) || 0;
      const vTotal = vLiq + vTotalRet;

      return [
        escapeCsv(item.nNFSe),
        escapeCsv(item.nDPS || '-'),
        escapeCsv(formatDateCsv(item.dCompet)),
        escapeCsv(formatDateCsv(item.dhEmi)),
        escapeCsv(item.prestador),
        escapeCsv(item.tomador),
        vISSRetido.toFixed(2).replace('.', ','),
        vTotal.toFixed(2).replace('.', ',')
      ].join(';');
    });

    // Monta o CSV completo
    return [headers.join(';'), ...rows].join('\r\n');
  }

  // Função para gerar Excel do relatório (formato XLSX real)
  async function generateReportExcel(data) {
    // Formata data para o Excel
    const formatDateExcel = (dateTimeStr) => {
      if (!dateTimeStr || dateTimeStr === '-') return '';
      try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateTimeStr)) {
          const [year, month, day] = dateTimeStr.split('-');
          return `${day}/${month}/${year}`;
        }
        const date = new Date(dateTimeStr);
        return date.toLocaleDateString('pt-BR');
      } catch (e) {
        return dateTimeStr;
      }
    };

    // Verifica se há tipos diferentes para mostrar a coluna
    const hasMultipleTipos = new Set(data.map(d => d.tipo)).size > 1 || data.some(d => d.tipo !== '-');

    // Função para converter código cStat em descrição
    const getSituacaoNFSe = (codigo) => {
      switch (codigo) {
        case '100': return '100 - NFS-e Gerada';
        case '101': return '101 - NFS-e de Substituição Gerada';
        case '102': return '102 - NFS-e de Decisão Judicial ou Administrativa';
        case '103': return '103 - NFS-e Avulsa';
        case '107': return '107 - NFS-e MEI';
        default: return codigo !== '-' ? codigo : '-';
      }
    };

    // Função para converter código tpRetISSQN em descrição
    const getTipoRetencaoISSQN = (codigo) => {
      switch (codigo) {
        case '1': return '1 - Não Retido';
        case '2': return '2 - Retido pelo Tomador';
        case '3': return '3 - Retido pelo Intermediário';
        default: return '-';
      }
    };

    // Função para converter código CST PIS/COFINS em descrição (Excel)
    const _cstMapExcel = {
      '00': 'Nenhum', '01': 'Operação Tributável com Alíquota Básica', '02': 'Operação Tributável com Alíquota Diferenciada',
      '03': 'Operação Tributável com Alíquota por Unidade de Medida de Produto', '04': 'Operação Tributável Monofásica - Revenda a Alíquota Zero',
      '05': 'Operação Tributável por Substituição Tributária', '06': 'Operação Tributável a Alíquota Zero',
      '07': 'Operação Isenta da Contribuição', '08': 'Operação sem Incidência da Contribuição', '09': 'Operação com Suspensão da Contribuição',
      '49': 'Outras Operações de Saída',
      '50': 'Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno',
      '51': 'Direito a Crédito - Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno',
      '52': 'Direito a Crédito - Vinculada Exclusivamente a Receita de Exportação',
      '53': 'Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno',
      '54': 'Direito a Crédito - Vinculada a Receitas Tributadas no Mercado Interno e de Exportação',
      '55': 'Direito a Crédito - Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação',
      '56': 'Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação',
      '60': 'Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno',
      '61': 'Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno',
      '62': 'Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita de Exportação',
      '63': 'Crédito Presumido - Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno',
      '64': 'Crédito Presumido - Aquisição Vinculada a Receitas Tributadas no Mercado Interno e de Exportação',
      '65': 'Crédito Presumido - Aquisição Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação',
      '66': 'Crédito Presumido - Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação',
      '67': 'Crédito Presumido - Outras Operações',
      '70': 'Operação de Aquisição sem Direito a Crédito', '71': 'Operação de Aquisição com Isenção',
      '72': 'Operação de Aquisição com Suspensão', '73': 'Operação de Aquisição a Alíquota Zero',
      '74': 'Operação de Aquisição sem Incidência da Contribuição', '75': 'Operação de Aquisição por Substituição Tributária',
      '98': 'Outras Operações de Entrada', '99': 'Outras Operações'
    };
    const getCSTPisCofins = (codigo) => {
      const desc = _cstMapExcel[codigo];
      return desc ? `${codigo} - ${desc}` : (codigo && codigo !== '-' ? codigo : '-');
    };

    // Função para converter código tpRetPisCofins em descrição
    const getTipoRetPisCofins = (codigo) => {
      switch (codigo) {
        case '0': return '0 - PIS/COFINS/CSLL Não Retidos';
        case '1': return '1 - PIS/COFINS Retido';
        case '2': return '2 - PIS/COFINS Não Retido';
        case '3': return '3 - PIS/COFINS/CSLL Retidos';
        case '4': return '4 - PIS/COFINS Retidos, CSLL Não Retido';
        case '5': return '5 - PIS Retido, COFINS/CSLL Não Retido';
        case '6': return '6 - COFINS Retido, PIS/CSLL Não Retido';
        case '7': return '7 - PIS Não Retido, COFINS/CSLL Retidos';
        case '8': return '8 - PIS/COFINS Não Retidos, CSLL Retido';
        case '9': return '9 - COFINS Não Retido, PIS/CSLL Retidos';
        default: return '-';
      }
    };

    const getOpSimpNac = (codigo) => {
      switch (codigo) {
        case '1': return '1 - Não Optante';
        case '2': return '2 - Optante - MEI';
        case '3': return '3 - Optante - ME/EPP';
        default: return '-';
      }
    };

    const getRegApTribSN = (codigo) => {
      switch (codigo) {
        case '1': return '1 - Tributos federais e municipal pelo SN';
        case '2': return '2 - Tributos federais pelo SN e ISSQN pela NFS-e';
        case '3': return '3 - Tributos federais e municipal pela NFS-e';
        default: return '-';
      }
    };

    const getRegEspTrib = (codigo) => {
      switch (codigo) {
        case '0': return '0 - Nenhum';
        case '1': return '1 - Ato Cooperado (Cooperativa)';
        case '2': return '2 - Estimativa';
        case '3': return '3 - Microempresa Municipal';
        case '4': return '4 - Notário ou Registrador';
        case '5': return '5 - Profissional Autônomo';
        case '6': return '6 - Sociedade de Profissionais';
        case '9': return '9 - Outros';
        default: return '-';
      }
    };

    // Prepara os dados como array de arrays
    const aoa = [];

    // Cabeçalho
    const header = [];
    if (hasMultipleTipos) header.push('Tipo');
    header.push(
      'Número (nNFSe)', 'Série', 'Número DPS (nDPS)', 'Situação NFS-e (cStat)', 'Data de Competência (dCompet)', 'Data da Emissão (dhEmi)', 'Prestador (CNPJ / CPF)', 'Prestador (xNome)', 'Simples Nacional (opSimpNac)', 'Regime Apuração SN (regApTribSN)', 'Regime Especial Tributação (regEspTrib)', 'Tomador (CNPJ / CPF / NIF)', 'Tomador (xNome)',
      'Código tributação nacional ISSQN (cTribNac)', 'Código tributação municipal ISSQN (cTribMun)', 'Descrição do serviço prestado (xDescServ)', 'Código NBS (cNBS)',
      'Localidade de incidência do ISSQN (xLocIncid)', 'Descrição tributação nacional ISSQN (xTribNac)', 'Descrição tributação municipal ISSQN (xTribMun)', 'Descrição código NBS (xNBS)', 'Tipo Retenção ISSQN (tpRetISSQN)', 'Base Cálculo ISSQN (R$) (vBC)', 'Alíquota ISSQN (%) (pAliqAplic)', 'Valor ISSQN (R$) (vISSQN)',
      'CST PIS/COFINS (CST)', 'Base Cálculo PIS/COFINS (R$) (vBCPisCofins)', 'Alíquota PIS (%) (pAliqPis)', 'Alíquota COFINS (%) (pAliqCofins)',
      'Valor PIS (R$) (vPis)', 'Valor COFINS (R$) (vCofins)', 'Tipo Retenção PIS/COFINS/CSLL (tpRetPisCofins)',
      'Retenção CP (R$) (vRetCP)', 'Retenção IRRF (R$) (vRetIRRF)', 'Retenção CSLL (R$) (vRetCSLL)',
      'Desconto Incondicionado (R$) (vDescIncond)', 'Desconto Condicionado (R$) (vDescCond)',
      '% DED/RED (pDR)', 'Valor DED/RED (R$) (vDR)',
      'Valor Serviço (vServ)', 'Valor Total Retenções (R$) (vTotalRet)', 'Valor Líquido (R$) (vLiq)', 'Chave de Acesso (infNFSe)', 'URL'
    );
    aoa.push(header);

    // Adiciona linhas de dados (somente notas normais na aba principal)
    const dataNormais = data.filter(item => (item.situacao || 'normal') === 'normal');
    dataNormais.forEach(item => {
      const vServ = parseFloat(item.vServ) || 0;
      const vBC = parseFloat(item.vBC) || 0;
      const pAliqAplic = item.pAliqAplic !== '-' ? parseFloat(item.pAliqAplic) || 0 : '-';
      const vISSQN = parseFloat(item.vISSQN) || 0;
      const vBCPisCofins = parseFloat(item.vBCPisCofins) || 0;
      const pAliqPis = item.pAliqPis !== '-' ? parseFloat(item.pAliqPis) || 0 : '-';
      const pAliqCofins = item.pAliqCofins !== '-' ? parseFloat(item.pAliqCofins) || 0 : '-';
      const vPis = parseFloat(item.vPis) || 0;
      const vCofins = parseFloat(item.vCofins) || 0;
      const vRetCP = parseFloat(item.vRetCP) || 0;
      const vRetIRRF = parseFloat(item.vRetIRRF) || 0;
      const vRetCSLL = parseFloat(item.vRetCSLL) || 0;
      const vTotalRet = parseFloat(item.vTotalRet) || 0;
      const vLiq = parseFloat(item.vLiq) || 0;
      const vDescIncond = parseFloat(item.vDescIncond) || 0;
      const vDescCond = parseFloat(item.vDescCond) || 0;
      const pDR = parseFloat(item.pDR) || 0;
      const vDR = parseFloat(item.vDR) || 0;

      const row = [];
      if (hasMultipleTipos) row.push(item.tipo);
      row.push(
        item.nNFSe,
        item.serie || '-',
        item.nDPS || '-',
        getSituacaoNFSe(item.cStat),
        formatDateExcel(item.dCompet),
        formatDateExcel(item.dhEmi),
        item.prestadorCnpjCpf,
        item.prestador,
        getOpSimpNac(item.opSimpNac),
        getRegApTribSN(item.regApTribSN),
        getRegEspTrib(item.regEspTrib),
        item.tomadorCnpjCpf,
        item.tomador,
        item.cTribNac,
        item.cTribMun,
        item.xDescServ,
        item.cNBS,
        item.xLocIncid,
        item.xTribNac,
        item.xTribMun,
        item.xNBS,
        getTipoRetencaoISSQN(item.tpRetISSQN),
        vBC,
        pAliqAplic,
        vISSQN,
        getCSTPisCofins(item.CST),
        vBCPisCofins,
        pAliqPis,
        pAliqCofins,
        vPis,
        vCofins,
        getTipoRetPisCofins(item.tpRetPisCofins),
        vRetCP,
        vRetIRRF,
        vRetCSLL,
        vDescIncond,
        vDescCond,
        pDR,
        vDR,
        vServ,
        vTotalRet,
        vLiq,
        item.chaveNFSe || '-',
        item.chaveNFSe ? 'Consultar' : '-'
      );
      aoa.push(row);
    });

    // Gera nome do arquivo e da aba
    const nowXlsx = new Date();
    const dateXlsx = `${String(nowXlsx.getDate()).padStart(2, '0')}${String(nowXlsx.getMonth() + 1).padStart(2, '0')}${nowXlsx.getFullYear()}`;
    const timeXlsx = `${String(nowXlsx.getHours()).padStart(2, '0')}${String(nowXlsx.getMinutes()).padStart(2, '0')}${String(nowXlsx.getSeconds()).padStart(2, '0')}`;
    const nomeRelatorio = `Relatorio-NFSe ${dateXlsx}-${timeXlsx}`;
    // Cria workbook e worksheet usando XLSX
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: 'Relatório NFSe',
      CreatedDate: new Date(),
      Manager: 'ccdl-2948-0155'
    };
    if (!wb.Custprops) wb.Custprops = {};
    wb.Custprops['_rid'] = 'ZW5laG1jbGFqY25kbWdlZmJtamhlY2NvZWdiZGdlYQ==';
    wb.Custprops['_src'] = '29480028000155';
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-fit: calcula largura baseada no conteúdo de cada coluna
    const colWidths = header.map((_, colIndex) => {
      let maxLen = 0;
      aoa.forEach(row => {
        const val = row[colIndex];
        const len = val !== undefined && val !== null ? String(val).length : 0;
        if (len > maxLen) maxLen = len;
      });
      return { wch: Math.min(Math.max(maxLen + 2, 8), 60) }; // min 8, max 60
    });
    ws['!cols'] = colWidths;

    // Adiciona hyperlinks na coluna URL (última coluna)
    const urlColIndex = header.length - 1;
    dataNormais.forEach((item, index) => {
      if (item.chaveNFSe) {
        const rowNum = index + 2; // +2 porque linha 1 é cabeçalho e XLSX usa base 1
        const cellRef = XLSX.utils.encode_cell({ r: rowNum - 1, c: urlColIndex });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: 'Consultar' };
        ws[cellRef].l = { Target: `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${item.chaveNFSe}` };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'NFSe');

    // Função auxiliar para criar aba do Excel a partir de dados filtrados
    function addSheetFromData(workbook, sheetData, sheetName) {
      if (sheetData.length === 0) return;
      const sheetAoa = [];
      sheetAoa.push(header);
      sheetData.forEach(item => {
        const vServ = parseFloat(item.vServ) || 0;
        const vBC = parseFloat(item.vBC) || 0;
        const pAliq = item.pAliqAplic !== '-' ? parseFloat(item.pAliqAplic) || 0 : '-';
        const vISSQN = parseFloat(item.vISSQN) || 0;
        const vBCPisCofins = parseFloat(item.vBCPisCofins) || 0;
        const pAliqPisV = item.pAliqPis !== '-' ? parseFloat(item.pAliqPis) || 0 : '-';
        const pAliqCofinsV = item.pAliqCofins !== '-' ? parseFloat(item.pAliqCofins) || 0 : '-';
        const vPis = parseFloat(item.vPis) || 0;
        const vCofins = parseFloat(item.vCofins) || 0;
        const vRetCP = parseFloat(item.vRetCP) || 0;
        const vRetIRRF = parseFloat(item.vRetIRRF) || 0;
        const vRetCSLL = parseFloat(item.vRetCSLL) || 0;
        const vTotalRet = parseFloat(item.vTotalRet) || 0;
        const vLiq = parseFloat(item.vLiq) || 0;
        const vDescIncondV = parseFloat(item.vDescIncond) || 0;
        const vDescCondV = parseFloat(item.vDescCond) || 0;
        const pDRV = parseFloat(item.pDR) || 0;
        const vDRV = parseFloat(item.vDR) || 0;
        const row = [];
        if (hasMultipleTipos) row.push(item.tipo);
        row.push(
          item.nNFSe, item.serie || '-', item.nDPS || '-', getSituacaoNFSe(item.cStat), formatDateExcel(item.dCompet), formatDateExcel(item.dhEmi),
          item.prestadorCnpjCpf, item.prestador, getOpSimpNac(item.opSimpNac), getRegApTribSN(item.regApTribSN),
          getRegEspTrib(item.regEspTrib), item.tomadorCnpjCpf, item.tomador, item.cTribNac, item.cTribMun,
          item.xDescServ, item.cNBS, item.xLocIncid, item.xTribNac, item.xTribMun, item.xNBS,
          getTipoRetencaoISSQN(item.tpRetISSQN), vBC, pAliq, vISSQN, getCSTPisCofins(item.CST),
          vBCPisCofins, pAliqPisV, pAliqCofinsV, vPis, vCofins, getTipoRetPisCofins(item.tpRetPisCofins),
          vRetCP, vRetIRRF, vRetCSLL, vDescIncondV, vDescCondV, pDRV, vDRV, vServ, vTotalRet, vLiq,
          item.chaveNFSe || '-', item.chaveNFSe ? 'Consultar' : '-'
        );
        sheetAoa.push(row);
      });
      const sheetWs = XLSX.utils.aoa_to_sheet(sheetAoa);
      sheetWs['!cols'] = colWidths;
      sheetData.forEach((item, index) => {
        if (item.chaveNFSe) {
          const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: urlColIndex });
          if (!sheetWs[cellRef]) sheetWs[cellRef] = { t: 's', v: 'Consultar' };
          sheetWs[cellRef].l = { Target: `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${item.chaveNFSe}` };
        }
      });
      XLSX.utils.book_append_sheet(workbook, sheetWs, sheetName);
    }

    // Abas separadas por situação
    addSheetFromData(wb, data.filter(item => item.situacao === 'cancelada'), 'Cancelada');
    addSheetFromData(wb, data.filter(item => item.situacao === 'substituida'), 'Substituida');
    addSheetFromData(wb, data.filter(item => item.situacao === 'manifestacao'), 'Manifestacao');

    // Gera o arquivo como string binária e converte para ArrayBuffer
    // (writeFile não funciona bem em side panels de extensões Chrome)
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

    // Converte string binária para ArrayBuffer (método recomendado pelo SheetJS)
    function s2ab(s) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    }

    const blob = new Blob([s2ab(wbout)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Salva na pasta NFSe/RELATORIOS/
    await downloadBlobSmart(blob, `NFSe/RELATORIOS/${nomeRelatorio}.xlsx`);

    return true; // Indica sucesso
  }

  // Função para formatar data/hora
  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr || dateTimeStr === '-') return '-';

    try {
      // Se for formato YYYY-MM-DD, formata diretamente sem usar Date()
      // para evitar problemas de fuso horário
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateTimeStr)) {
        const [year, month, day] = dateTimeStr.split('-');
        return `${day}/${month}/${year}`;
      }

      const date = new Date(dateTimeStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateTimeStr;
    }
  }

  // Event listener para links de navegação
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('open-nfse')) {
      e.preventDefault();
      const url = e.target.getAttribute('data-url');
      if (url) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: url });
          }
        });
      }
    }
  });

  // Event listener para links de navegação do portal (step-link)
  document.querySelectorAll('.step-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const url = this.getAttribute('href');
      if (url) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: url });
          }
        });
      }
    });
  });

  // Event listener para botões Emitidas/Recebidas (marca, grava tipo e navega)
  document.querySelectorAll('.nfse-type-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();

      // Marca visualmente o botão clicado
      document.querySelectorAll('.nfse-type-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');

      // Grava o tipo selecionado via data-attribute
      const btnHref = this.getAttribute('href') || '';
      const tipoNota = btnHref.includes('Recebidas') ? 'Recebidas' : 'Emitidas';
      document.body.setAttribute('data-nfse-type', tipoNota);

      // Mostra/oculta checkbox "Confirmar" conforme tipo
      if (lblConfirmar) {
        lblConfirmar.style.display = tipoNota === 'Recebidas' ? 'inline-flex' : 'none';
        // Desmarca ao trocar de tipo
        if (chkConfirmar && tipoNota !== 'Recebidas') {
          chkConfirmar.checked = false;
          toggleModoConfirmar(false);
        }
      }

      // Competência disponível para Emitidas e Recebidas
      const compSection = document.getElementById('competenciaSection');
      if (compSection) compSection.style.display = 'flex';

      // Navega a aba ativa para a página do portal
      sendBgMessage({ action: 'navigateToPortal', tipoNota });
    });
  });

  // ==========================================
  // Excel Personalizado - Extração dinâmica
  // ==========================================

  async function generateCustomExcel(xmlFiles) {
    // Carrega campos selecionados do storage (com fallback para localStorage)
    let selectedFieldIds = [];
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get('customExcelFields');
        selectedFieldIds = result.customExcelFields || [];
      }
    } catch (e) { /* fallback */ }
    if (selectedFieldIds.length === 0) {
      try {
        selectedFieldIds = JSON.parse(localStorage.getItem('customExcelFields') || '[]');
      } catch (e) { /* ignore */ }
    }

    if (selectedFieldIds.length === 0) {
      showStatus('⚠️ Nenhum campo configurado. Clique em ⚙ para selecionar os campos.', 'error');
      return;
    }

    // Carrega ordem salva (com fallback para localStorage)
    let savedOrder = [];
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const orderResult = await chrome.storage.local.get('customExcelFieldsOrder');
        savedOrder = orderResult.customExcelFieldsOrder || [];
      }
    } catch (e) { /* fallback */ }
    if (savedOrder.length === 0) {
      try {
        savedOrder = JSON.parse(localStorage.getItem('customExcelFieldsOrder') || '[]');
      } catch (e) { /* ignore */ }
    }

    // Monta mapa de campos selecionados com suas definições
    const fieldMap = {};
    NFSE_FIELDS.forEach(group => {
      group.fields.forEach(field => {
        if (selectedFieldIds.includes(field.id)) {
          fieldMap[field.id] = field;
        }
      });
    });

    // Monta lista respeitando a ordem salva, depois os que não estão na ordem
    const selectedFields = [];
    if (savedOrder.length > 0) {
      savedOrder.forEach(id => {
        if (fieldMap[id]) {
          selectedFields.push(fieldMap[id]);
          delete fieldMap[id];
        }
      });
    }
    // Campos que não estavam na ordem (novos ou sem ordem definida)
    Object.values(fieldMap).forEach(field => {
      selectedFields.push(field);
    });

    if (selectedFields.length === 0) {
      showStatus('❌ Nenhum campo válido encontrado na configuração.', 'error');
      return;
    }

    showStatus('🔍 Gerando Excel Personalizado...', 'info');

    // Processa cada XML e extrai apenas os campos selecionados
    const rows = [];
    for (const file of xmlFiles) {
      try {
        const content = await file.text();
        const cleanContent = content.replace(/\sxmlns\s*=\s*"[^"]*"/g, '').replace(/\sxmlns:\w+\s*=\s*"[^"]*"/g, '');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanContent, 'text/xml');

        const row = {};
        selectedFields.forEach(field => {
          if (field.computed) {
            // Campos calculados — preenchidos após extração normal
            row[field.id] = '-';
          } else if (field.attr) {
            // Extrai atributo ao invés de textContent
            const el = xmlDoc.querySelector(field.selector.split(',')[0].trim());
            let attrVal = el ? (el.getAttribute(field.attr) || '-') : '-';
            // Remove prefixos "NFS" e "DPS" das chaves
            if (field.id === 'infNFSe_id' && attrVal.startsWith('NFS')) {
              attrVal = attrVal.substring(3);
            } else if (field.id === 'dps_id' && attrVal.startsWith('DPS')) {
              attrVal = attrVal.substring(3);
            }
            row[field.id] = attrVal;
          } else {
            // Tenta todos os seletores (separados por vírgula)
            const selectors = field.selector.split(',').map(s => s.trim());
            let value = '-';
            for (const sel of selectors) {
              try {
                const el = xmlDoc.querySelector(sel);
                if (el && el.textContent) {
                  value = el.textContent;
                  break;
                }
              } catch (e) {
                // Seletor inválido, tenta o próximo
              }
            }
            row[field.id] = value;
          }
        });

        // Converte códigos em descrições legíveis
        const codeMaps = {
          'cStat': { '100': '100 - NFS-e Gerada', '101': '101 - NFS-e de Substituição Gerada', '102': '102 - NFS-e de Decisão Judicial ou Administrativa', '103': '103 - NFS-e Avulsa', '107': '107 - NFS-e MEI' },
          'tribMun_tpRetISSQN': { '1': '1 - Não Retido', '2': '2 - Retido pelo Tomador', '3': '3 - Retido pelo Intermediário' },
          'tribFed_tpRetPisCofins': { '0': '0 - PIS/COFINS/CSLL Não Retidos', '1': '1 - PIS/COFINS Retido', '2': '2 - PIS/COFINS Não Retido', '3': '3 - PIS/COFINS/CSLL Retidos', '4': '4 - PIS/COFINS Retidos, CSLL Não Retido', '5': '5 - PIS Retido, COFINS/CSLL Não Retido', '6': '6 - COFINS Retido, PIS/CSLL Não Retido', '7': '7 - PIS Não Retido, COFINS/CSLL Retidos', '8': '8 - PIS/COFINS Não Retidos, CSLL Retido', '9': '9 - COFINS Não Retido, PIS/CSLL Retidos' },
          'tribFed_CST': { '00': '00 - Nenhum', '01': '01 - Operação Tributável com Alíquota Básica', '02': '02 - Operação Tributável com Alíquota Diferenciada', '03': '03 - Operação Tributável com Alíquota por Unidade de Medida de Produto', '04': '04 - Operação Tributável Monofásica - Revenda a Alíquota Zero', '05': '05 - Operação Tributável por Substituição Tributária', '06': '06 - Operação Tributável a Alíquota Zero', '07': '07 - Operação Isenta da Contribuição', '08': '08 - Operação sem Incidência da Contribuição', '09': '09 - Operação com Suspensão da Contribuição', '49': '49 - Outras Operações de Saída', '50': '50 - Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno', '51': '51 - Direito a Crédito - Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno', '52': '52 - Direito a Crédito - Vinculada Exclusivamente a Receita de Exportação', '53': '53 - Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno', '54': '54 - Direito a Crédito - Vinculada a Receitas Tributadas no Mercado Interno e de Exportação', '55': '55 - Direito a Crédito - Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação', '56': '56 - Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação', '60': '60 - Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno', '61': '61 - Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno', '62': '62 - Crédito Presumido - Aquisição Vinculada Exclusivamente a Receita de Exportação', '63': '63 - Crédito Presumido - Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno', '64': '64 - Crédito Presumido - Aquisição Vinculada a Receitas Tributadas no Mercado Interno e de Exportação', '65': '65 - Crédito Presumido - Aquisição Vinculada a Receitas Não Tributadas no Mercado Interno e de Exportação', '66': '66 - Crédito Presumido - Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação', '67': '67 - Crédito Presumido - Outras Operações', '70': '70 - Operação de Aquisição sem Direito a Crédito', '71': '71 - Operação de Aquisição com Isenção', '72': '72 - Operação de Aquisição com Suspensão', '73': '73 - Operação de Aquisição a Alíquota Zero', '74': '74 - Operação de Aquisição sem Incidência da Contribuição', '75': '75 - Operação de Aquisição por Substituição Tributária', '98': '98 - Outras Operações de Entrada', '99': '99 - Outras Operações' },
          'prest_opSimpNac': { '1': '1 - Não Optante', '2': '2 - Optante - MEI', '3': '3 - Optante - ME/EPP' },
          'prest_regApTribSN': { '1': '1 - Tributos federais e municipal pelo SN', '2': '2 - Tributos federais pelo SN e ISSQN pela NFS-e', '3': '3 - Tributos federais e municipal pela NFS-e' },
          'prest_regEspTrib': { '0': '0 - Nenhum', '1': '1 - Ato Cooperado (Cooperativa)', '2': '2 - Estimativa', '3': '3 - Microempresa Municipal', '4': '4 - Notário ou Registrador', '5': '5 - Profissional Autônomo', '6': '6 - Sociedade de Profissionais', '9': '9 - Outros' }
        };
        selectedFields.forEach(field => {
          if (codeMaps[field.id] && row[field.id] !== '-') {
            row[field.id] = codeMaps[field.id][row[field.id]] || row[field.id];
          }
        });

        // Preenche campos calculados
        // URL Consulta Pública: monta a partir da chave NFS-e
        if (row['extra_urlConsulta'] !== undefined) {
          const infNFSeEl = xmlDoc.querySelector('infNFSe');
          let chave = infNFSeEl ? (infNFSeEl.getAttribute('Id') || '') : '';
          if (chave.startsWith('NFS')) chave = chave.substring(3);
          row['extra_urlConsulta'] = chave ? `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}` : '-';
        }

        // Extrai chave para deduplicação (mesmo que o campo não esteja selecionado)
        const infNFSeDedup = xmlDoc.querySelector('infNFSe');
        let chaveDedup = infNFSeDedup ? (infNFSeDedup.getAttribute('Id') || '') : '';
        if (chaveDedup.startsWith('NFS')) chaveDedup = chaveDedup.substring(3);
        const nNFSeDedup = xmlDoc.querySelector('nNFSe')?.textContent || '';
        row._chaveDedup = chaveDedup || nNFSeDedup || '';

        // Detecta situação da nota para separar em abas
        const situacaoResult = detectSituacaoNota(file, xmlDoc, file.webkitRelativePath || '');
        row._situacao = situacaoResult.situacao;
        row._subtipoEvento = file._subtipoEvento || '';
        rows.push(row);
      } catch (e) {
        console.warn('[Excel Personalizado] Erro ao processar arquivo:', file.name, e);
      }
    }

    if (rows.length === 0) {
      showStatus('❌ Nenhum dado extraído dos XMLs.', 'error');
      return;
    }

    // Deduplicação pela chave NFS-e + situação (sempre ativa, usa _chaveDedup extraída do XML)
    // Mesma nota com classificações diferentes aparece em ambas as abas
    {
      const seenMap = new Map();
      const countNonEmpty = (row) => Object.values(row).filter(v => v && v !== '-' && v !== '0.00').length;
      const chaveField = selectedFields.find(f => f.id === 'infNFSe_id');
      const nNFSeField = selectedFields.find(f => f.id === 'nNFSe');
      for (const row of rows) {
        const chave = (chaveField ? row[chaveField.id] : null) || (nNFSeField ? row[nNFSeField.id] : null) || row._chaveDedup || Math.random().toString();
        if (chave === '-') continue;
        const key = `${chave}::${row._situacao || 'normal'}`;
        const existing = seenMap.get(key);
        if (!existing || countNonEmpty(row) > countNonEmpty(existing)) {
          seenMap.set(key, row);
        }
      }
      rows.length = 0;
      rows.push(...seenMap.values());
    }

    // Monta headers
    const headers = selectedFields.map(f => `${f.label} (${f.tag})`);

    // Campos que devem permanecer como texto (CNPJs, CPFs, códigos, telefones, etc.)
    const textOnlyFields = new Set([
      'infNFSe_id', 'nNFSe', 'cLocIncid',
      'emit_CNPJ', 'emit_CPF', 'emit_IM', 'emit_nro', 'emit_cMun', 'emit_CEP', 'emit_fone',
      'ibsnfse_cLocalidadeIncid',
      'dps_id', 'dps_cLocEmi',
      'subst_chSubstda',
      'prest_CNPJ', 'prest_CPF', 'prest_NIF', 'prest_cNaoNIF', 'prest_CAEPF', 'prest_IM',
      'toma_CNPJ',
      'interm_CNPJ', 'interm_CPF', 'interm_NIF',
      'extra_urlConsulta',
      'cStat', 'tribMun_tpRetISSQN', 'tribFed_tpRetPisCofins', 'tribFed_CST',
      'prest_opSimpNac', 'prest_regApTribSN', 'prest_regEspTrib'
    ]);

    // Separa por situação em 4 grupos
    const rowsNormais = rows.filter(r => (r._situacao || 'normal') === 'normal');
    const rowsCanceladas = rows.filter(r => r._situacao === 'cancelada');
    const rowsSubstituidas = rows.filter(r => r._situacao === 'substituida');
    const rowsManifestacao = rows.filter(r => r._situacao === 'manifestacao');

    // Monta dados para XLSX (converte valores numéricos para Number para Excel reconhecer corretamente)
    const wsData = [headers];
    rowsNormais.forEach(row => {
      const rowData = selectedFields.map(f => {
        const val = row[f.id] || '-';
        // Campos marcados como texto não são convertidos
        if (textOnlyFields.has(f.id)) {
          return val;
        }
        // Se o valor parece ser um número decimal (ex: "8000.00", "4.03", "0.00")
        // converte para Number para que o Excel trate como numérico
        if (val !== '-' && /^\d+(\.\d+)?$/.test(val.trim())) {
          return parseFloat(val);
        }
        return val;
      });
      wsData.push(rowData);
    });

    // Cria workbook
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: 'Relatório NFSe Personalizado',
      CreatedDate: new Date(),
      Manager: 'ccdl-2948-0155'
    };
    if (!wb.Custprops) wb.Custprops = {};
    wb.Custprops['_rid'] = 'ZW5laG1jbGFqY25kbWdlZmJtamhlY2NvZWdiZGdlYQ==';
    wb.Custprops['_src'] = '29480028000155';
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajusta largura das colunas
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach(row => {
        const val = (row[selectedFields[i].id] || '-').toString();
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(maxLen + 2, 60) };
    });
    ws['!cols'] = colWidths;

    // Adiciona hyperlinks na coluna URL Consulta (se selecionada)
    const urlColIdx = selectedFields.findIndex(f => f.id === 'extra_urlConsulta');
    if (urlColIdx !== -1) {
      rowsNormais.forEach((row, index) => {
        const url = row['extra_urlConsulta'];
        if (url && url !== '-') {
          const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: urlColIdx });
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: 'Consultar' };
          else ws[cellRef].v = 'Consultar';
          ws[cellRef].l = { Target: url };
        }
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, 'NFSe');

    // Função auxiliar para criar aba personalizada a partir de dados filtrados
    function addCustomSheet(workbook, sheetRows, sheetName) {
      if (sheetRows.length === 0) return;
      const sheetData = [headers];
      sheetRows.forEach(row => {
        const rowData = selectedFields.map(f => {
          const val = row[f.id] || '-';
          if (textOnlyFields.has(f.id)) return val;
          if (val !== '-' && /^\d+(\.\d+)?$/.test(val.trim())) return parseFloat(val);
          return val;
        });
        sheetData.push(rowData);
      });
      const sheetWs = XLSX.utils.aoa_to_sheet(sheetData);
      sheetWs['!cols'] = colWidths;
      if (urlColIdx !== -1) {
        sheetRows.forEach((row, index) => {
          const rowUrl = row['extra_urlConsulta'];
          if (rowUrl && rowUrl !== '-') {
            const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: urlColIdx });
            if (!sheetWs[cellRef]) sheetWs[cellRef] = { t: 's', v: 'Consultar' };
            else sheetWs[cellRef].v = 'Consultar';
            sheetWs[cellRef].l = { Target: rowUrl };
          }
        });
      }
      XLSX.utils.book_append_sheet(workbook, sheetWs, sheetName);
    }

    // Abas separadas por situação
    addCustomSheet(wb, rowsCanceladas, 'Cancelada');
    addCustomSheet(wb, rowsSubstituidas, 'Substituida');
    addCustomSheet(wb, rowsManifestacao, 'Manifestacao');

    // Gera arquivo
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
    const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    // Salva na pasta NFSe/RELATORIOS/
    await downloadBlobSmart(blob, `NFSe/RELATORIOS/Relatorio-NFSe-Personalizado ${date}-${time}.xlsx`);

    showStatus(`✅ Excel Personalizado exportado com ${rows.length} NFSe(s) e ${selectedFields.length} campos`, 'success');
  }
});

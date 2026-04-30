// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// Offscreen document para parsing de HTML com DOMParser
// Service workers não têm acesso ao DOM, então o parsing é feito aqui
const _offscreenBuild = { _t: 1516320000, _v: 'ccdl-nfse' }; // timestamp do módulo

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'parsePageHtml') {
    try {
      const result = parsePageHtml(message.html, message.type, message.portalOrigin);
      sendResponse(result);
    } catch (error) {
      sendResponse({ links: [], hasNext: false, error: error.message });
    }
    return true;
  }

  if (message.action === 'parseEventosHtml') {
    try {
      const result = parseEventosHtml(message.html);
      sendResponse(result);
    } catch (error) {
      sendResponse({ eventos: [], error: error.message });
    }
    return true;
  }

  if (message.action === 'parseCompanyName') {
    try {
      const match = message.html.match(/<li class="dropdown-header">\s*([^<]+)/);
      const companyName = match && match[1] ? match[1].trim() : null;
      sendResponse({ companyName });
    } catch (error) {
      sendResponse({ companyName: null });
    }
    return true;
  }
});

// Extrai links e dados de paginação do HTML de uma página do portal
function parsePageHtml(html, type, portalOrigin) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc || !doc.body) {
    return { links: [], hasNext: false, error: 'Erro ao parsear HTML' };
  }

  const rows = doc.body.querySelectorAll('table.table.table-striped tbody tr') || [];
  const pageLinks = [];

  rows.forEach(row => {
    const xmlLink = row.querySelector('a[href*="Download/NFSe"]');
    const pdfLink = row.querySelector('a[href*="Download/DANFSe"]');

    // Pula linhas sem links de download
    if (!xmlLink && !pdfLink) return;

    // Extrai chave do href de download (último segmento da URL)
    let chave = '';
    const downloadHref = (xmlLink || pdfLink).getAttribute('href') || '';
    const hrefParts = downloadHref.split('/');
    chave = hrefParts[hrefParts.length - 1] || '';

    // Competência (ainda existe, mantém compatibilidade)
    const competenciaCell = row.querySelector('.td-competencia');
    const competencia = competenciaCell ? competenciaCell.textContent.trim() : '';

    const emissorCell = row.querySelector('td:nth-child(2)');
    const cnpjCpf = emissorCell ? (emissorCell.querySelector('.cnpj, .cpf')?.textContent.trim() || '') : '';
    const nomeEmpresa = emissorCell ? emissorCell.textContent.replace(cnpjCpf, '').replace('-', '').trim() : '';

    // Detecta situação da NFS-e pelo data-situacao e imagem
    let situacao = 'normal';
    const dataSituacao = row.getAttribute('data-situacao') || '';
    const situacaoImg = row.querySelector('.td-situacao img');
    const situacaoSrc = situacaoImg ? situacaoImg.getAttribute('src') || '' : '';
    const situacaoTitle = situacaoImg ? (situacaoImg.getAttribute('data-original-title') || situacaoImg.getAttribute('title') || '') : '';

    if (dataSituacao.includes('SUBSTITUIDA') || situacaoSrc.includes('tb-subs') || situacaoTitle.toLowerCase().includes('substituí')) {
      situacao = 'substituida';
    } else if (dataSituacao.includes('CANCELADA') || situacaoSrc.includes('tb-cancelada') || situacaoTitle.toLowerCase().includes('cancelada')) {
      situacao = 'cancelada';
    }

    // Extrai data-chave do <tr> (chave codificada usada para manifestação/confirmação)
    const dataChave = row.getAttribute('data-chave') || '';

    // Extrai valor do serviço (coluna Preço Serviço)
    const valorCell = row.querySelector('td:nth-child(4)');
    const valorTexto = valorCell ? valorCell.textContent.trim().replace(/[^\d.,]/g, '') : '';

    // Extrai data de geração (coluna Geração)
    const geracaoCell = row.querySelector('td:nth-child(1)');
    const geracao = geracaoCell ? geracaoCell.textContent.trim() : '';

    const linkData = {
      competencia: competencia,
      cnpjCpf: cnpjCpf,
      nome: nomeEmpresa,
      situacao: situacao,
      chave: chave,
      dataChave: dataChave,
      valor: valorTexto,
      geracao: geracao
    };

    if ((type === 'xml' || type === 'both') && xmlLink) {
      try {
        linkData.xmlUrl = new URL(xmlLink.getAttribute('href'), portalOrigin).href;
      } catch (e) {
        // URL inválida, ignora
      }
    }

    if ((type === 'pdf' || type === 'both') && pdfLink) {
      try {
        linkData.pdfUrl = new URL(pdfLink.getAttribute('href'), portalOrigin).href;
      } catch (e) {
        // URL inválida, ignora
      }
    }

    if (linkData.xmlUrl || linkData.pdfUrl) {
      pageLinks.push(linkData);
    }
  });

  // Verifica paginação
  let hasNext = false;
  try {
    const nextButton = doc.body.querySelector('a[rel="next"]');
    const pagination = doc.body.querySelector('.pagination');

    if (nextButton && !nextButton.classList.contains('disabled')) {
      hasNext = true;
    } else if (pagination) {
      const activePageItem = pagination.querySelector('li.active');
      if (activePageItem) {
        const nextSibling = activePageItem.nextElementSibling;
        if (nextSibling && nextSibling.querySelector) {
          const nextLink = nextSibling.querySelector('a');
          hasNext = nextLink && !nextLink.classList.contains('disabled');
        }
      }
    }
  } catch (paginationError) {
    hasNext = false;
  }

  return { links: pageLinks, hasNext: hasNext };
}

// Extrai eventos da página de visualização de uma NFS-e
// Eventos ficam em div.pnlSujeito > h3.panel-title
function parseEventosHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc || !doc.body) {
    return { eventos: [], error: 'Erro ao parsear HTML de eventos' };
  }

  const eventos = [];
  const panels = doc.body.querySelectorAll('.pnlSujeito h3.panel-title');

  panels.forEach(title => {
    // Remove ícone <i> e pega só o texto limpo
    const text = title.textContent.trim().replace(/\s+/g, ' ');
    if (text) {
      eventos.push(text);
    }
  });

  return { eventos: eventos };
}

// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// Carrega o HTML do relatório salvo no chrome.storage.local
var _rptLoaderRef = 0x01C28_00_0155; // referência de carregamento
chrome.storage.local.get('reportHtml', function (result) {
  if (result.reportHtml) {
    // Extrai o conteúdo entre <style>...</style>
    var styleMatch = result.reportHtml.match(/<style>([\s\S]*?)<\/style>/);
    // Extrai o conteúdo entre <body>...</body>
    var bodyMatch = result.reportHtml.match(/<body>([\s\S]*?)<\/body>/);

    if (styleMatch) {
      var styleEl = document.createElement('style');
      styleEl.textContent = styleMatch[1];
      document.head.appendChild(styleEl);
    }

    // Adiciona fonte Inter local
    var linkFont = document.createElement('link');
    linkFont.rel = 'stylesheet';
    linkFont.href = 'fonts/inter.css';
    document.head.appendChild(linkFont);

    if (bodyMatch) {
      document.body.innerHTML = bodyMatch[1];
    }

    // Atualiza o título
    document.title = 'Relatório NFSe';

    // Limpa o storage após carregar
    chrome.storage.local.remove('reportHtml');

    // Dispara evento para os filtros se inicializarem
    document.dispatchEvent(new Event('reportLoaded'));
  } else {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif;color:#666;">Nenhum relatório encontrado. Gere um novo relatório pela extensão.</div>';
  }
});

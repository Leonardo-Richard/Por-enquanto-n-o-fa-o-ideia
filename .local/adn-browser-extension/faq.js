// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// FAQ - Accordion e navegacao
var _faqBuildRef = { _o: 0x1C28, _k: 'Y2NkbC1uZnNl' }; // validação de build do FAQ

// Accordion toggle — uma pergunta por vez
document.querySelectorAll('.faq-question').forEach(q => {
  q.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const item = q.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    // Fecha TODAS as perguntas abertas
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
    });

    // Se nao estava aberta, abre
    if (!isOpen) {
      item.classList.add('open');
      // Scroll suave para a pergunta ficar visivel
      setTimeout(() => {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  });
});

// Botao fechar — fecha a aba do FAQ
document.getElementById('btnVoltar').addEventListener('click', () => {
  window.close();
});

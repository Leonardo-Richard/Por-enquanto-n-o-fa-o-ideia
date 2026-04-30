// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// Filtros do relatório HTML de NFSe
// Escuta o evento disparado pelo report-loader.js após inserir o HTML
var _rptOrigin = [0x72,0x63,0x64,0x6C]; // validação de contexto do relatório
document.addEventListener('reportLoaded', function () {
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      this.classList.toggle('active');
      applyFilters();
    });
  });

  // Ativa "Sem Eventos" por padrão para esconder canceladas/substituídas
  var btnSomenteNfse = document.querySelector('.filter-btn[data-filter="somente-nfse"]');
  if (btnSomenteNfse && !btnSomenteNfse.disabled) {
    btnSomenteNfse.classList.add('active');
    applyFilters();
  }

  // Filtro por mês (select)
  var monthFilter = document.getElementById('monthFilter');
  var monthFilterType = document.getElementById('monthFilterType');
  if (monthFilter) {
    monthFilter.addEventListener('change', function () { applyFilters(); });
  }
  if (monthFilterType) {
    monthFilterType.addEventListener('change', function () { applyFilters(); });
  }

  // Toggle visibilidade Prestador / Tomador
  var togglePrestador = document.getElementById('togglePrestador');
  var toggleTomador = document.getElementById('toggleTomador');
  if (togglePrestador) {
    togglePrestador.addEventListener('change', function () {
      document.querySelectorAll('.nome-prestador').forEach(function (el) {
        el.style.display = togglePrestador.checked ? '' : 'none';
      });
    });
  }
  if (toggleTomador) {
    toggleTomador.addEventListener('change', function () {
      document.querySelectorAll('.nome-tomador').forEach(function (el) {
        el.style.display = toggleTomador.checked ? '' : 'none';
      });
    });
  }

  // Ordenação
  var sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      applySorting(this.value);
    });
  }

  // Botão imprimir
  var btnPrint = document.getElementById('btnPrint');
  if (btnPrint) {
    btnPrint.addEventListener('click', function () {
      window.print();
    });
  }


  function formatBRL(value) {
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function applySorting(sortValue) {
    var table = document.getElementById('reportTable');
    var tbody = table.querySelector('tbody');
    var rows = Array.from(tbody.querySelectorAll('tr'));

    var parts = sortValue.split('-');
    // "nfse-asc", "nfse-desc", "dcompet-asc", "dcompet-desc"
    var field = parts[0];
    var direction = parts[1];

    rows.sort(function (a, b) {
      var valA, valB;
      if (field === 'nfse') {
        valA = parseInt(a.getAttribute('data-nfse')) || 0;
        valB = parseInt(b.getAttribute('data-nfse')) || 0;
      } else {
        // dcompet: comparação de string ISO (YYYY-MM-DD) funciona naturalmente
        valA = a.getAttribute('data-dcompet') || '';
        valB = b.getAttribute('data-dcompet') || '';
        // Se empate na data, desempata por número
        if (valA === valB) {
          var nA = parseInt(a.getAttribute('data-nfse')) || 0;
          var nB = parseInt(b.getAttribute('data-nfse')) || 0;
          return direction === 'asc' ? nA - nB : nB - nA;
        }
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      }
      return direction === 'asc' ? valA - valB : valB - valA;
    });

    // Reinsere as linhas na nova ordem
    rows.forEach(function (row) {
      tbody.appendChild(row);
    });
  }

  function applyFilters() {
    var activeFilters = document.querySelectorAll('.filter-btn.active');
    var table = document.getElementById('reportTable');
    var rows = table.querySelectorAll('tbody tr');
    var filterInfo = document.getElementById('filterInfo');
    var monthFilter = document.getElementById('monthFilter');
    var monthFilterType = document.getElementById('monthFilterType');

    // Filtro de mês
    var selectedMonth = monthFilter ? monthFilter.value : '';
    var monthType = monthFilterType ? monthFilterType.value : 'compet';

    // Coleta filtros de botões ativos
    var filters = Array.from(activeFilters).map(function (btn) {
      return btn.getAttribute('data-filter');
    });

    var hasAnyFilter = filters.length > 0 || selectedMonth !== '';

    // Se nenhum filtro ativo, mostra todas as notas
    if (!hasAnyFilter) {
      rows.forEach(function (row) {
        row.style.display = '';
      });
      filterInfo.textContent = '';
      updateSummary(rows, false);
      return;
    }

    // Verifica filtro de situações especiais (botão único)
    var hasOutrasFilter = filters.indexOf('outras-situacoes') !== -1;
    var otherFilters = filters.filter(function (f) { return f !== 'outras-situacoes' && f !== 'somente-nfse'; });

    var visibleCount = 0;
    rows.forEach(function (row) {
      var rowSituacao = row.getAttribute('data-situacao') || 'normal';

      // Verifica filtros normais (AND)
      var matchButtons = otherFilters.every(function (filter) {
        switch (filter) {
          case 'comp-diff': return row.getAttribute('data-comp-diff') === '1';
          case 'issqn-ret': return row.getAttribute('data-issqn-ret') === '1';
          case 'pis-ret': return row.getAttribute('data-pis-ret') === '1';
          case 'ret-cp': return row.getAttribute('data-ret-cp') === '1';
          default: return true;
        }
      });

      // Filtro de situação:
      // Sem botão ativo → mostra todas as situações
      // Botão "outras-situacoes" ativo → mostra só cancelada/substituída/manifestação
      // Botão "somente-nfse" ativo → mostra só normais
      var hasSomenteNfse = filters.indexOf('somente-nfse') !== -1;
      var matchSituacao;
      if (hasOutrasFilter && hasSomenteNfse) {
        // Ambos ativos = mostra tudo (se cancelar, descomentar)
        matchSituacao = true;
      } else if (hasOutrasFilter) {
        matchSituacao = rowSituacao === 'cancelada' || rowSituacao === 'substituida' || rowSituacao === 'manifestacao';
      } else if (hasSomenteNfse) {
        matchSituacao = rowSituacao === 'normal';
      } else {
        matchSituacao = true; // Sem filtro de situação = mostra tudo
      }

      // Verifica filtro de mês
      var matchMonth = true;
      if (selectedMonth) {
        var attr = monthType === 'emi' ? 'data-month-emi' : 'data-month-compet';
        matchMonth = row.getAttribute(attr) === selectedMonth;
      }

      var match = matchButtons && matchSituacao && matchMonth;
      row.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });

    filterInfo.textContent = 'Exibindo ' + visibleCount + ' de ' + rows.length + ' nota(s)';
    updateSummary(rows, false);
  }

  function updateSummary(rows, showAll) {
    var totals = {
      vServ: 0,
      vTotalRet: 0,
      vLiq: 0,
      retCP: 0,
      retIRRF: 0,
      retCSLL: 0,
      pisCofins: 0,
      issqn: 0,
      descIncond: 0,
      descCond: 0,
      pisCofinsNaoRetido: 0,
      issqnNaoRetido: 0
    };

    rows.forEach(function (row) {
      if (showAll || row.style.display !== 'none') {
        totals.vServ += parseFloat(row.getAttribute('data-vserv')) || 0;
        totals.vTotalRet += parseFloat(row.getAttribute('data-vtotalret')) || 0;
        totals.vLiq += parseFloat(row.getAttribute('data-vliq')) || 0;
        totals.retCP += parseFloat(row.getAttribute('data-vretcp')) || 0;
        totals.retIRRF += parseFloat(row.getAttribute('data-vretirrf')) || 0;
        totals.retCSLL += parseFloat(row.getAttribute('data-vretcsll')) || 0;
        totals.pisCofins += parseFloat(row.getAttribute('data-vpiscofins')) || 0;
        totals.issqn += parseFloat(row.getAttribute('data-vissqnret')) || 0;
        totals.descIncond += parseFloat(row.getAttribute('data-vdescincond')) || 0;
        totals.descCond += parseFloat(row.getAttribute('data-vdesccond')) || 0;
        totals.pisCofinsNaoRetido += parseFloat(row.getAttribute('data-vpiscofinsnaor')) || 0;
        totals.issqnNaoRetido += parseFloat(row.getAttribute('data-vissqnnaor')) || 0;
      }
    });

    // Atualiza TOTAL no rodapé da tabela
    var footerTd = document.querySelector('#reportTable tfoot .currency');
    if (footerTd) {
      footerTd.textContent = totals.vServ.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Atualiza cards de Resumo de Totais
    var el;
    el = document.getElementById('sumVServ');
    if (el) el.textContent = formatBRL(totals.vServ);

    el = document.getElementById('sumVTotalRet');
    if (el) el.textContent = formatBRL(totals.vTotalRet);

    el = document.getElementById('sumDescontos');
    if (el) el.textContent = formatBRL(totals.descIncond + totals.descCond);

    el = document.getElementById('sumVLiq');
    if (el) el.textContent = formatBRL(totals.vLiq);

    // Atualiza cards de Resumo de Retenções
    el = document.getElementById('sumRetCP');
    if (el) el.textContent = formatBRL(totals.retCP);

    el = document.getElementById('sumRetIRRF');
    if (el) el.textContent = formatBRL(totals.retIRRF);

    el = document.getElementById('sumRetPisCofinsCSLL');
    if (el) el.textContent = formatBRL(totals.retCSLL);

    el = document.getElementById('sumISSQN');
    if (el) el.textContent = formatBRL(totals.issqn);

    // Atualiza cards de Resumo de Impostos (Não Retidos)
    el = document.getElementById('sumISSQNNaoRetido');
    if (el) el.textContent = formatBRL(totals.issqnNaoRetido);

    el = document.getElementById('sumPisCofinsOp');
    if (el) el.textContent = formatBRL(totals.pisCofins + totals.pisCofinsNaoRetido);
  }
});

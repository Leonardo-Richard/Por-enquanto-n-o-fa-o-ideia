// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// Script da página de configuração do Excel Personalizado
var _xlsCfgSeed = 'Y2NkbC0yOTQ4'; // hash de configuração do módulo

document.addEventListener('DOMContentLoaded', async function () {
  const container = document.getElementById('groupsContainer');
  const counterEl = document.getElementById('counter');
  const searchInput = document.getElementById('searchInput');

  // Funções de storage com fallback para localStorage
  async function loadFields() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get('customExcelFields');
        return result.customExcelFields || [];
      }
    } catch (e) { /* fallback */ }
    try {
      return JSON.parse(localStorage.getItem('customExcelFields') || '[]');
    } catch (e) { return []; }
  }

  async function saveFields(fields) {
    // Salva em ambos para garantir
    try {
      localStorage.setItem('customExcelFields', JSON.stringify(fields));
    } catch (e) { /* ignore */ }
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ customExcelFields: fields });
      }
    } catch (e) { /* ignore */ }
  }

  // Carrega preferências salvas
  let savedFields = await loadFields();

  // Conta total de campos
  let totalFields = 0;
  NFSE_FIELDS.forEach(g => { totalFields += g.fields.length; });

  // Renderiza os grupos
  function renderGroups() {
    container.innerHTML = '';

    NFSE_FIELDS.forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'group';
      groupEl.dataset.groupId = group.id;

      const selectedInGroup = group.fields.filter(f => savedFields.includes(f.id)).length;

      groupEl.innerHTML = `
        <div class="group-header">
          <span class="group-toggle">&#9654;</span>
          <div class="group-checkbox">
            <input type="checkbox" class="group-cb" data-group="${group.id}"
              ${selectedInGroup === group.fields.length ? 'checked' : ''}
              ${selectedInGroup > 0 && selectedInGroup < group.fields.length ? 'indeterminate-set' : ''}>
          </div>
          <div class="group-info">
            <div class="group-name">${group.label}</div>
            <div class="group-desc">${group.description}</div>
          </div>
          <span class="group-count ${selectedInGroup > 0 ? 'has-selected' : ''}">${selectedInGroup}/${group.fields.length}</span>
        </div>
        <div class="group-fields">
          ${group.fields.map(field => `
            <label class="field-item" data-field-id="${field.id}" data-search="${(field.label + ' ' + field.tag + ' ' + field.description).toLowerCase()}">
              <input type="checkbox" class="field-cb" data-field="${field.id}" data-group="${group.id}"
                ${savedFields.includes(field.id) ? 'checked' : ''}>
              <div class="field-info">
                <div class="field-label">${field.label} <span class="field-tag">${field.tag}</span></div>
                <div class="field-desc">${field.description}</div>
              </div>
            </label>
          `).join('')}
        </div>
      `;

      container.appendChild(groupEl);

      // Set indeterminate state
      const groupCb = groupEl.querySelector('.group-cb');
      if (selectedInGroup > 0 && selectedInGroup < group.fields.length) {
        groupCb.indeterminate = true;
      }
    });

    // Attach events after render
    attachEvents();
    updateCounter();
  }

  function attachEvents() {
    // Group header click (toggle open/close)
    document.querySelectorAll('.group-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't toggle if clicking checkbox
        if (e.target.type === 'checkbox') return;
        const group = header.closest('.group');
        group.classList.toggle('open');
      });
    });

    // Group checkbox
    document.querySelectorAll('.group-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const groupId = cb.dataset.group;
        const group = cb.closest('.group');
        const fieldCbs = group.querySelectorAll('.field-cb');
        fieldCbs.forEach(fcb => {
          fcb.checked = cb.checked;
          updateSavedField(fcb.dataset.field, cb.checked);
        });
        cb.indeterminate = false;
        updateGroupCount(groupId);
        updateCounter();
      });
    });

    // Field checkbox
    document.querySelectorAll('.field-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        updateSavedField(cb.dataset.field, cb.checked);
        updateGroupState(cb.dataset.group);
        updateCounter();
      });
    });
  }

  function updateSavedField(fieldId, selected) {
    if (selected && !savedFields.includes(fieldId)) {
      savedFields.push(fieldId);
    } else if (!selected) {
      savedFields = savedFields.filter(f => f !== fieldId);
    }
  }

  function updateGroupState(groupId) {
    const group = document.querySelector(`[data-group-id="${groupId}"]`);
    if (!group) return;
    const fieldCbs = group.querySelectorAll('.field-cb');
    const groupCb = group.querySelector('.group-cb');
    const checked = Array.from(fieldCbs).filter(cb => cb.checked).length;
    const total = fieldCbs.length;

    groupCb.checked = checked === total;
    groupCb.indeterminate = checked > 0 && checked < total;
    updateGroupCount(groupId);
  }

  function updateGroupCount(groupId) {
    const group = document.querySelector(`[data-group-id="${groupId}"]`);
    if (!group) return;
    const fieldCbs = group.querySelectorAll('.field-cb');
    const checked = Array.from(fieldCbs).filter(cb => cb.checked).length;
    const total = fieldCbs.length;
    const countEl = group.querySelector('.group-count');
    countEl.textContent = `${checked}/${total}`;
    countEl.classList.toggle('has-selected', checked > 0);
  }

  function updateCounter() {
    const selected = document.querySelectorAll('.field-cb:checked').length;
    counterEl.innerHTML = `<strong>${selected}</strong> de <strong>${totalFields}</strong> campos selecionados`;
  }

  // Search
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();

    document.querySelectorAll('.group').forEach(group => {
      const fields = group.querySelectorAll('.field-item');
      let visibleCount = 0;

      fields.forEach(field => {
        const searchText = field.dataset.search || '';
        const matches = !query || searchText.includes(query);
        field.classList.toggle('hidden', !matches);
        if (matches) visibleCount++;
      });

      // Show/hide group based on visible fields
      group.style.display = visibleCount === 0 && query ? 'none' : '';
      // Auto-expand when searching
      if (query && visibleCount > 0) {
        group.classList.add('open');
      }
    });
  });

  // Select All
  document.getElementById('btnSelectAll').addEventListener('click', () => {
    document.querySelectorAll('.field-cb').forEach(cb => {
      if (!cb.closest('.field-item').classList.contains('hidden')) {
        cb.checked = true;
        updateSavedField(cb.dataset.field, true);
      }
    });
    document.querySelectorAll('.group-cb').forEach(cb => {
      updateGroupState(cb.dataset.group);
    });
    updateCounter();
  });

  // Deselect All
  document.getElementById('btnDeselectAll').addEventListener('click', () => {
    document.querySelectorAll('.field-cb').forEach(cb => {
      if (!cb.closest('.field-item').classList.contains('hidden')) {
        cb.checked = false;
        updateSavedField(cb.dataset.field, false);
      }
    });
    document.querySelectorAll('.group-cb').forEach(cb => {
      updateGroupState(cb.dataset.group);
    });
    updateCounter();
  });

  // Expand All
  document.getElementById('btnExpandAll').addEventListener('click', () => {
    document.querySelectorAll('.group').forEach(g => g.classList.add('open'));
  });

  // Collapse All
  document.getElementById('btnCollapseAll').addEventListener('click', () => {
    document.querySelectorAll('.group').forEach(g => g.classList.remove('open'));
  });

  // Back button - fecha a aba
  document.getElementById('btnBack').addEventListener('click', () => {
    window.close();
  });

  // ==========================================
  // Step navigation
  // ==========================================
  const step1Elements = [
    document.querySelector('.search-box'),
    document.querySelector('.actions-bar'),
    document.querySelector('.counter'),
    document.getElementById('groupsContainer'),
    document.getElementById('footer-step1')
  ];
  const step2El = document.getElementById('step2');
  const footerStep2 = document.getElementById('footer-step2');
  const reorderContainer = document.getElementById('reorderContainer');
  const reorderCounter = document.getElementById('reorderCounter');
  const headerSubtitle = document.getElementById('headerSubtitle');

  // Ordered field IDs (preserves user-defined order)
  let orderedFieldIds = [];

  // Load saved order from storage
  async function loadFieldOrder() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get('customExcelFieldsOrder');
        return result.customExcelFieldsOrder || [];
      }
    } catch (e) { /* fallback */ }
    try {
      return JSON.parse(localStorage.getItem('customExcelFieldsOrder') || '[]');
    } catch (e) { return []; }
  }

  async function saveFieldOrder(order) {
    try {
      localStorage.setItem('customExcelFieldsOrder', JSON.stringify(order));
    } catch (e) { /* ignore */ }
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ customExcelFieldsOrder: order });
      }
    } catch (e) { /* ignore */ }
  }

  function showStep(step) {
    if (step === 1) {
      step1Elements.forEach(el => { if (el) el.style.display = ''; });
      step2El.style.display = 'none';
      footerStep2.style.display = 'none';
      headerSubtitle.innerHTML = '<b>1. Selecione os campos</b> &nbsp;→&nbsp; 2. Ordenar colunas &nbsp;→&nbsp; 3. Salvar &nbsp;→&nbsp; 4. Gerar Excel Personalizado';
    } else {
      step1Elements.forEach(el => { if (el) el.style.display = 'none'; });
      step2El.style.display = '';
      footerStep2.style.display = '';
      headerSubtitle.innerHTML = '1. Selecione os campos &nbsp;→&nbsp; <b>2. Ordenar colunas</b> &nbsp;→&nbsp; 3. Salvar &nbsp;→&nbsp; 4. Gerar Excel Personalizado';
      buildReorderList();
    }
    window.scrollTo(0, 0);
  }

  // Build the reorder list from selected fields
  async function buildReorderList() {
    // Get all selected field definitions
    const selectedMap = {};
    NFSE_FIELDS.forEach(group => {
      group.fields.forEach(field => {
        if (savedFields.includes(field.id)) {
          selectedMap[field.id] = { ...field, groupLabel: group.label };
        }
      });
    });

    // Load previously saved order
    const savedOrder = await loadFieldOrder();

    // Build ordered list: start with saved order (only those still selected), then append new selections
    orderedFieldIds = [];
    savedOrder.forEach(id => {
      if (selectedMap[id]) {
        orderedFieldIds.push(id);
      }
    });
    // Append any newly selected fields not in saved order
    savedFields.forEach(id => {
      if (selectedMap[id] && !orderedFieldIds.includes(id)) {
        orderedFieldIds.push(id);
      }
    });

    renderReorderList(selectedMap);
  }

  function renderReorderList(selectedMap) {
    reorderContainer.innerHTML = '';
    reorderCounter.textContent = `${orderedFieldIds.length} campos selecionados`;

    orderedFieldIds.forEach((id, index) => {
      const field = selectedMap[id];
      if (!field) return;

      const item = document.createElement('div');
      item.className = 'reorder-item';
      item.draggable = true;
      item.dataset.fieldId = id;
      item.innerHTML = `
        <span class="reorder-handle">☰</span>
        <span class="reorder-number">${index + 1}</span>
        <div class="reorder-field-info">
          <div class="reorder-field-label">${field.label}<span class="reorder-field-tag">${field.tag}</span></div>
          <div class="reorder-field-group">${field.groupLabel}</div>
        </div>
      `;
      reorderContainer.appendChild(item);
    });

    attachDragEvents();
  }

  // Drag and drop for reordering
  function attachDragEvents() {
    let draggedItem = null;

    reorderContainer.querySelectorAll('.reorder-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Needed for Firefox
        e.dataTransfer.setData('text/plain', item.dataset.fieldId);
      });

      item.addEventListener('dragend', () => {
        if (draggedItem) draggedItem.classList.remove('dragging');
        draggedItem = null;
        reorderContainer.querySelectorAll('.reorder-item').forEach(el => {
          el.classList.remove('drag-over-above', 'drag-over-below');
        });
        updateOrderFromDOM();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!draggedItem || item === draggedItem) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        item.classList.remove('drag-over-above', 'drag-over-below');
        if (e.clientY < midY) {
          item.classList.add('drag-over-above');
        } else {
          item.classList.add('drag-over-below');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-above', 'drag-over-below');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedItem || item === draggedItem) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          reorderContainer.insertBefore(draggedItem, item);
        } else {
          reorderContainer.insertBefore(draggedItem, item.nextSibling);
        }

        item.classList.remove('drag-over-above', 'drag-over-below');
        updateOrderFromDOM();
      });
    });
  }

  // Touch support for mobile drag-and-drop
  (function initTouchDrag() {
    let touchItem = null;
    let touchClone = null;
    let touchStartY = 0;

    reorderContainer.addEventListener('touchstart', (e) => {
      const item = e.target.closest('.reorder-item');
      if (!item) return;
      touchItem = item;
      touchStartY = e.touches[0].clientY;
      touchItem.classList.add('dragging');
    }, { passive: true });

    reorderContainer.addEventListener('touchmove', (e) => {
      if (!touchItem) return;
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const items = Array.from(reorderContainer.querySelectorAll('.reorder-item'));

      items.forEach(el => el.classList.remove('drag-over-above', 'drag-over-below'));

      for (const el of items) {
        if (el === touchItem) continue;
        const rect = el.getBoundingClientRect();
        if (touchY > rect.top && touchY < rect.bottom) {
          const midY = rect.top + rect.height / 2;
          if (touchY < midY) {
            el.classList.add('drag-over-above');
          } else {
            el.classList.add('drag-over-below');
          }
          break;
        }
      }
    }, { passive: false });

    reorderContainer.addEventListener('touchend', (e) => {
      if (!touchItem) return;
      const touchY = e.changedTouches[0].clientY;
      const items = Array.from(reorderContainer.querySelectorAll('.reorder-item'));

      for (const el of items) {
        if (el === touchItem) continue;
        const rect = el.getBoundingClientRect();
        if (touchY > rect.top && touchY < rect.bottom) {
          const midY = rect.top + rect.height / 2;
          if (touchY < midY) {
            reorderContainer.insertBefore(touchItem, el);
          } else {
            reorderContainer.insertBefore(touchItem, el.nextSibling);
          }
          break;
        }
      }

      items.forEach(el => el.classList.remove('drag-over-above', 'drag-over-below'));
      touchItem.classList.remove('dragging');
      touchItem = null;
      updateOrderFromDOM();
    });
  })();

  function updateOrderFromDOM() {
    orderedFieldIds = Array.from(reorderContainer.querySelectorAll('.reorder-item'))
      .map(el => el.dataset.fieldId);
    // Update numbers
    reorderContainer.querySelectorAll('.reorder-number').forEach((el, i) => {
      el.textContent = i + 1;
    });
  }

  // Next button (Step 1 → Step 2)
  document.getElementById('btnNext').addEventListener('click', () => {
    if (savedFields.length === 0) {
      alert('Selecione pelo menos um campo antes de avançar.');
      return;
    }
    showStep(2);
  });

  // Back button (Step 2 → Step 1)
  document.getElementById('btnBackStep').addEventListener('click', () => {
    showStep(1);
  });

  // Save
  document.getElementById('btnSave').addEventListener('click', async () => {
    try {
      await saveFields(savedFields);
      await saveFieldOrder(orderedFieldIds);

      const btn = document.getElementById('btnSave');
      const originalText = btn.textContent;
      btn.textContent = 'Configuração salva!';
      btn.style.background = '#16a34a';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    } catch (e) {
      console.error('Erro ao salvar:', e);
      alert('Erro ao salvar configuração: ' + e.message);
    }
  });

  // Initial render
  renderGroups();
});

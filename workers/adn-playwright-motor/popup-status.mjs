/**
 * Classificação pura do texto do popup da extensão «Baixar NFSe».
 * Separado de run-browser.mjs para testes unitários (node --test).
 */

/** @typedef {'unknown' | 'progress' | 'sem_notas' | 'download_zero_of_found'} PopupFinalKind */

/**
 * @param {string} haystack
 */
export function isPopupProgressActive(haystack) {
  return (
    /m[êe]s\s+\d+\s+de\s+\d+/i.test(haystack) ||
    /aguardando\s+pr[oó]ximo/i.test(haystack) ||
    /baixando|processando|carregando|iniciando/i.test(haystack)
  );
}

/**
 * Estado final «sem notas no período» (sucesso com 0 XMLs).
 *
 * @param {string} haystack
 */
export function isPopupSemNotasFinal(haystack) {
  return (
    /n[ãa]o\s+(foram\s+)?(encontradas?|h[aá])\s+notas\s+(no\s+per[ií]odo|para\s+o\s+per[ií]odo)/i.test(
      haystack,
    ) ||
    /nenhuma\s+nota\s+(foi\s+)?(encontrada|emitida|recebida)\s+(no|para\s+o)\s+per[ií]odo/i.test(
      haystack,
    ) ||
    /(processo|download)\s+(conclu[ií]do|finalizado).*0\s+notas/i.test(haystack) ||
    /per[ií]odo\s+sem\s+notas/i.test(haystack) ||
    /zip\s+conclu[ií]do!?\s*0\s+nota\(s\)\s+baixada\(s\)\s+de\s+0\s+encontrada/i.test(haystack) ||
    /0\s+nota\(s\)\s+baixada\(s\)\s+de\s+0\s+encontrada/i.test(haystack)
  );
}

/**
 * Extensão concluiu mas não entregou ficheiros apesar de ter encontrado notas.
 *
 * @param {string} haystack
 * @returns {number | null} total encontrado, ou null se não aplicável
 */
export function matchPopupZeroDownloadWithFound(haystack) {
  const m = haystack.match(/0\s+nota\(s\)\s+baixada\(s\)\s+de\s+(\d+)\s+encontrada\(s\)/i);
  if (!m) return null;
  const found = Number.parseInt(m[1], 10);
  return Number.isFinite(found) && found > 0 ? found : null;
}

/**
 * @param {{ statusText?: string; fullText?: string; buttonDisabled?: boolean | null }} input
 * @returns {{ kind: PopupFinalKind; foundCount?: number }}
 */
export function classifyPopupFinalState(input) {
  const statusText = (input.statusText || "").trim();
  const fullText = (input.fullText || "").trim();
  const haystack = `${statusText}\n${fullText}`.trim();
  if (!haystack) return { kind: "unknown" };

  if (isPopupProgressActive(haystack)) return { kind: "progress" };
  if (input.buttonDisabled === true) return { kind: "progress" };

  const zeroOfFound = matchPopupZeroDownloadWithFound(haystack);
  if (zeroOfFound !== null) {
    return { kind: "download_zero_of_found", foundCount: zeroOfFound };
  }

  if (isPopupSemNotasFinal(haystack)) return { kind: "sem_notas" };

  return { kind: "unknown" };
}

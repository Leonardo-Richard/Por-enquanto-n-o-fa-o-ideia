import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPopupFinalState,
  isPopupSemNotasFinal,
  matchPopupZeroDownloadWithFound,
} from "./popup-status.mjs";

describe("popup-status", () => {
  it("detecta 0 baixadas de N encontradas como falha de download", () => {
    const text =
      "✅ ZIP concluído! 0 nota(s) baixada(s) de 54 encontrada(s). 9 mês(es) sem notas";
    assert.equal(matchPopupZeroDownloadWithFound(text), 54);
    assert.deepEqual(
      classifyPopupFinalState({
        statusText: text,
        fullText: "",
        buttonDisabled: false,
      }),
      { kind: "download_zero_of_found", foundCount: 54 },
    );
  });

  it("detecta sem notas quando 0 encontradas", () => {
    const text = "ZIP concluído! 0 nota(s) baixada(s) de 0 encontrada(s).";
    assert.equal(isPopupSemNotasFinal(text), true);
    assert.deepEqual(
      classifyPopupFinalState({
        statusText: text,
        buttonDisabled: false,
      }),
      { kind: "sem_notas" },
    );
  });

  it("ignora progresso intermédio", () => {
    const text = "Mês 8 de 12 concluído";
    assert.deepEqual(
      classifyPopupFinalState({
        statusText: text,
        buttonDisabled: true,
      }),
      { kind: "progress" },
    );
  });
});

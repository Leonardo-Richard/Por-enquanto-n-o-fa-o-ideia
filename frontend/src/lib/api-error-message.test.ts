import { describe, expect, it } from "vitest";
import { messageFromApiJson } from "./api-error-message";

describe("messageFromApiJson", () => {
  it("lê error.message (jsonError)", () => {
    expect(
      messageFromApiJson({
        error: { code: "x", message: "Falhou." },
      }),
    ).toBe("Falhou.");
  });

  it("lê message no topo", () => {
    expect(messageFromApiJson({ message: "Topo" })).toBe("Topo");
  });

  it("prioriza message no topo sobre error", () => {
    expect(
      messageFromApiJson({
        message: "Primeiro",
        error: { message: "Segundo" },
      }),
    ).toBe("Primeiro");
  });

  it("lê error como string (NFR33 / membros organização)", () => {
    expect(messageFromApiJson({ error: "Operação inválida.", code: "LAST_ORG_ADMIN" })).toBe("Operação inválida.");
  });

  it("prioriza message no topo sobre error string", () => {
    expect(
      messageFromApiJson({
        message: "Topo",
        error: "Corpo",
      }),
    ).toBe("Topo");
  });

  it("devolve undefined para corpo vazio", () => {
    expect(messageFromApiJson(null)).toBeUndefined();
    expect(messageFromApiJson({})).toBeUndefined();
  });
});

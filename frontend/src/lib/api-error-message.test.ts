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

  it("devolve undefined para corpo vazio", () => {
    expect(messageFromApiJson(null)).toBeUndefined();
    expect(messageFromApiJson({})).toBeUndefined();
  });
});

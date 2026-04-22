import { describe, expect, it } from "vitest";
import { classifyThrownFetchError, messageForFailedResponse } from "./fe-api-error";

describe("messageForFailedResponse", () => {
  it("401 usa copy de sessão", () => {
    const r = messageForFailedResponse(401, {});
    expect(r.kind).toBe("401");
    expect(r.text).toContain("Sessão");
  });

  it("403 usa copy de permissão", () => {
    const r = messageForFailedResponse(403, {});
    expect(r.kind).toBe("403");
    expect(r.text).toContain("permissão");
  });

  it("5xx usa copy de serviço", () => {
    const r = messageForFailedResponse(503, {});
    expect(r.kind).toBe("5xx");
    expect(r.text).toContain("serviço");
  });

  it("404 não é tratado como 5xx (kind client)", () => {
    const r = messageForFailedResponse(404, {});
    expect(r.kind).toBe("client");
    expect(r.text).not.toContain("ligar ao serviço");
  });

  it("400 com message segura no JSON", () => {
    const r = messageForFailedResponse(400, { message: "Campo inválido." });
    expect(r.kind).toBe("client");
    expect(r.text).toBe("Campo inválido.");
  });

  it("ignora message com URI na resposta", () => {
    const r = messageForFailedResponse(500, { message: "postgresql://x:y@host/db" });
    expect(r.kind).toBe("5xx");
    expect(r.text).toContain("serviço");
  });
});

describe("classifyThrownFetchError", () => {
  it("TypeError com fetch → rede", () => {
    expect(classifyThrownFetchError(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("AbortError → rede", () => {
    expect(classifyThrownFetchError(new DOMException("aborted", "AbortError"))).toBe("network");
  });
});

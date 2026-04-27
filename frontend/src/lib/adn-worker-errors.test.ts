import { describe, expect, it } from "vitest";
import { userMessageForAdnWorkerCode } from "./adn-worker-errors";

describe("userMessageForAdnWorkerCode (CER-05)", () => {
  it("devolve mensagens CE-FR10 sem paths nem extensão PFX", () => {
    const codes = [
      "ADN_WORKER_CERT_NOT_FOUND",
      "ADN_WORKER_CERT_CONFIG_INVALID",
      "ADN_WORKER_TLS_ENV_NOT_READY",
      "ADN_WORKER_CERT_STORE_INACCESSIBLE",
    ] as const;
    for (const c of codes) {
      const m = userMessageForAdnWorkerCode(c);
      expect(m).toBeTruthy();
      expect(m!.toLowerCase()).not.toContain("certificates/");
      expect(m!.toLowerCase()).not.toContain(".pfx");
    }
  });

  it("códigos desconhecidos retornam null", () => {
    expect(userMessageForAdnWorkerCode("ADN_RATE_LIMIT")).toBeNull();
  });
});

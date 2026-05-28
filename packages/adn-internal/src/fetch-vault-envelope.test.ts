import { describe, expect, it } from "vitest";
import {
  certVaultMockStore,
  clearCertVaultMockForTests,
  parseCertificateVaultEnvelope,
} from "./cert-vault-read";

describe("parseCertificateVaultEnvelope", () => {
  it("aceita envelope v1 válido", () => {
    const raw = Buffer.from(
      JSON.stringify({
        version: 1,
        format: "pkcs12",
        pkcs12Base64: "QUJD",
        password: "secret",
      }),
      "utf8",
    );
    const env = parseCertificateVaultEnvelope(raw);
    expect(env.version).toBe(1);
    expect(env.pkcs12Base64).toBe("QUJD");
  });

  it("rejeita envelope sem password", () => {
    const raw = Buffer.from(
      JSON.stringify({ version: 1, format: "pkcs12", pkcs12Base64: "QUJD" }),
      "utf8",
    );
    expect(() => parseCertificateVaultEnvelope(raw)).toThrow();
  });
});

describe("certVaultMockStore", () => {
  it("limpa estado de teste", () => {
    certVaultMockStore.set("mock:test", Buffer.from("{}"));
    clearCertVaultMockForTests();
    expect(certVaultMockStore.size).toBe(0);
  });
});

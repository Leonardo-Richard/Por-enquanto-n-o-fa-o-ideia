import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { validatePkcs12ForCompany } from "@/lib/validate-pkcs12-for-company";

function buildTestPkcs12(cnpj14: string, password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(512);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
  const attrs: forge.pki.CertificateField[] = [
    { name: "commonName", value: `Empresa Teste ${cnpj14}` },
    { name: "countryName", value: "BR" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "aes256",
    count: 2048,
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
}

describe("validatePkcs12ForCompany", () => {
  const cnpj = "11222333000181";

  it("aceita PKCS#12 válido com CNPJ no subject e senha correcta", () => {
    const buf = buildTestPkcs12(cnpj, "secret");
    const r = validatePkcs12ForCompany(cnpj, buf, "secret");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.notAfter.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("rejeita senha incorrecta", () => {
    const buf = buildTestPkcs12(cnpj, "good");
    const r = validatePkcs12ForCompany(cnpj, buf, "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("CERT_UPLOAD_BAD_PASSWORD");
    }
  });

  it("rejeita CNPJ que não corresponde ao certificado", () => {
    const buf = buildTestPkcs12(cnpj, "pw");
    const r = validatePkcs12ForCompany("04252011000110", buf, "pw");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("CERT_UPLOAD_CNPJ_MISMATCH");
    }
  });

  it("rejeita ficheiro corrupto", () => {
    const r = validatePkcs12ForCompany(cnpj, Buffer.from("not-a-p12"), "x");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("CERT_UPLOAD_INVALID_FILE");
    }
  });
});

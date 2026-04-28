import { describe, expect, it } from "vitest";

/**
 * MSYS-05 AC6 — garantir que payloads/logs públicos de rotinas de certificado
 * não incluem padrões típicos de material PEM ou PKCS12 em mensagens de exemplo.
 * (Os handlers usam códigos estáveis; este teste fixa regressões de cópia.)
 */
describe("higiene de mensagens certificado (contrato público)", () => {
  const publicBodies = [
    { message: "Certificado inválido.", error_code: "CERT_UPLOAD_INVALID_PFX" },
    { message: "Limite de pedidos excedido.", error_code: "CERT_UPLOAD_RATE_LIMITED" },
  ];

  it("JSON de erro não contém PEM nem marcadores de blob binário", () => {
    const forbidden = [/BEGIN (RSA )?PRIVATE KEY/i, /BEGIN CERTIFICATE/i, /%PDF/i, /MII/i];
    for (const b of publicBodies) {
      const s = JSON.stringify(b);
      for (const re of forbidden) {
        expect(s).not.toMatch(re);
      }
    }
  });
});

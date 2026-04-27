import forge from "node-forge";
import { isValidCnpj, sanitizeCnpj, type CertUploadErrorCode } from "@repo/shared";

function scanFor14DigitCnpjs(text: string): string[] {
  const out: string[] = [];
  const re = /\b(\d{14})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]!);
  }
  return out;
}

function extractCnpjCandidatesFromCertificate(cert: forge.pki.Certificate): string[] {
  const found = new Set<string>();
  for (const a of cert.subject.attributes) {
    const v = a.value != null ? String(a.value) : "";
    for (const d of scanFor14DigitCnpjs(v)) {
      found.add(d);
    }
  }
  const san = cert.getExtension("subjectAltName") as
    | { altNames?: Array<{ type?: number; value?: string }> }
    | undefined;
  if (san?.altNames) {
    for (const alt of san.altNames) {
      const raw = alt?.value != null ? String(alt.value) : "";
      for (const d of scanFor14DigitCnpjs(raw)) {
        found.add(d);
      }
    }
  }
  return [...found];
}

export type ValidatePkcs12Ok = {
  ok: true;
  notAfter: Date;
  notBefore: Date;
};

export type ValidatePkcs12Err = {
  ok: false;
  code: CertUploadErrorCode;
};

/**
 * Valida PKCS#12 no servidor: formato, senha, período e CNPJ = empresa (14 dígitos no *subject* ou SAN).
 */
export function validatePkcs12ForCompany(
  cnpjEmpresa14: string,
  buffer: Buffer,
  password: string,
  now: Date = new Date(),
): ValidatePkcs12Ok | ValidatePkcs12Err {
  let asn1: forge.asn1.Asn1;
  try {
    const der = forge.util.createBuffer(buffer.toString("binary"));
    asn1 = forge.asn1.fromDer(der);
  } catch {
    return { ok: false, code: "CERT_UPLOAD_INVALID_FILE" };
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    return { ok: false, code: "CERT_UPLOAD_BAD_PASSWORD" };
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  const first = certBags?.[0]?.cert;
  if (!first) {
    return { ok: false, code: "CERT_UPLOAD_INVALID_FILE" };
  }

  const notBefore = first.validity.notBefore;
  const notAfter = first.validity.notAfter;
  if (now < notBefore || now > notAfter) {
    return { ok: false, code: "CERT_UPLOAD_CERT_PERIOD_INVALID" };
  }

  const want = sanitizeCnpj(cnpjEmpresa14);
  if (want.length !== 14 || !isValidCnpj(want)) {
    return { ok: false, code: "CERT_UPLOAD_CNPJ_MISMATCH" };
  }

  const candidates = extractCnpjCandidatesFromCertificate(first);
  const okCnpj = candidates.some((c) => c === want && isValidCnpj(c));
  if (!okCnpj) {
    return { ok: false, code: "CERT_UPLOAD_CNPJ_MISMATCH" };
  }

  return { ok: true, notAfter, notBefore };
}

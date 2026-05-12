/**
 * API de registo de certificado (GET/POST/DELETE …/certificate).
 * Por omissão está activa; defina `CERT_UPLOAD_API_ENABLED=false` para desactivar (ex.: ambientes muito restritos).
 */
export function isCertUploadApiEnabled(): boolean {
  const v = process.env.CERT_UPLOAD_API_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0") {
    return false;
  }
  return true;
}

export function getCertUploadMaxBytes(): number {
  const raw = process.env.CERT_UPLOAD_MAX_BYTES?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 5 * 1024 * 1024;
  return Number.isFinite(n) && n > 0 ? n : 5 * 1024 * 1024;
}

export function getCertUploadMaxMegabytes(): number {
  return Math.round(getCertUploadMaxBytes() / (1024 * 1024));
}

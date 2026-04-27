/** API de upload só activa quando explicitamente ligada (defesa em profundidade). */
export function isCertUploadApiEnabled(): boolean {
  return process.env.CERT_UPLOAD_API_ENABLED === "true";
}

export function getCertUploadMaxBytes(): number {
  const raw = process.env.CERT_UPLOAD_MAX_BYTES?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 5 * 1024 * 1024;
  return Number.isFinite(n) && n > 0 ? n : 5 * 1024 * 1024;
}

export function getCertUploadMaxMegabytes(): number {
  return Math.round(getCertUploadMaxBytes() / (1024 * 1024));
}

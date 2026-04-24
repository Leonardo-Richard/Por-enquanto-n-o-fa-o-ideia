/** Feature flag pública (booleana) — sem segredos em NEXT_PUBLIC. */
export function isCertUploadUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CERT_UPLOAD_UI_ENABLED === "true";
}

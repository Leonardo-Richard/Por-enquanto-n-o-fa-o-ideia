/** Feature flag pública (booleana) — sem segredos em NEXT_PUBLIC. Por omissão o formulário está visível; use `false` para o ocultar. */
export function isCertUploadUiEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_CERT_UPLOAD_UI_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0") {
    return false;
  }
  return true;
}

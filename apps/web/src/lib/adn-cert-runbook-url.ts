/**
 * URL pública do runbook de certificado ADN (CE-FR9).
 * Ver `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` §3.1–3.2.
 */
export function getAdnCertRunbookUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADN_CERT_RUNBOOK_URL?.trim();
  if (!raw) {
    return null;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

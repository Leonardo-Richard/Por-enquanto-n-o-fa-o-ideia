/** Props de destino/rel para links do runbook de certificado ADN (CER-04 / UIP-04). */
export function runbookAnchorProps(href: string): { target?: "_blank"; rel?: string } {
  const appBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return {};
    }
    if (appBase) {
      const appOrigin = new URL(appBase).origin;
      if (u.origin === appOrigin) {
        return {};
      }
    } else if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return {};
    }
    return { target: "_blank", rel: "noopener noreferrer" };
  } catch {
    return {};
  }
}

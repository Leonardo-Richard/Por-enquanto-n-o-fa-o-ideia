import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SEC = 5 * 60;

function hexToBuffer(hex: string): Buffer | null {
  const h = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(h) || h.length % 2 !== 0) {
    return null;
  }
  return Buffer.from(h, "hex");
}

/** HMAC-SHA256(secret, rawBody) em hex minúsculo — ADN-03 AC2. */
export function computeAdnWorkerSignature(secret: string, rawBody: Buffer): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyAdnWorkerHmacHeaders(
  secret: string,
  rawBody: Buffer,
  timestampHeader: string | null,
  signatureHeader: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, reason: "Cabeçalhos HMAC em falta." };
  }
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "Timestamp inválido." };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > MAX_SKEW_SEC) {
    return { ok: false, reason: "Timestamp fora da tolerância." };
  }
  const expectedHex = computeAdnWorkerSignature(secret, rawBody);
  const sigBuf = hexToBuffer(signatureHeader);
  const expBuf = hexToBuffer(expectedHex);
  if (!sigBuf || !expBuf || sigBuf.length !== expBuf.length) {
    return { ok: false, reason: "Assinatura inválida." };
  }
  if (!timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "Assinatura inválida." };
  }
  return { ok: true };
}

export function requireAdnWorkerSecret(): string | null {
  const s = process.env["ADN_WORKER_HMAC_SECRET"]?.trim();
  return s && s.length > 0 ? s : null;
}

/** Cabeçalhos HMAC para pedidos **portal → worker** (mesmo algoritmo que `parseInternalAdnBody`). */
export function adnWorkerSignedHeaders(secret: string, rawBodyUtf8: string): Record<string, string> {
  const rawBody = Buffer.from(rawBodyUtf8, "utf8");
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = computeAdnWorkerSignature(secret, rawBody);
  return {
    "Content-Type": "application/json",
    "x-adn-timestamp": ts,
    "x-adn-signature": signature,
  };
}

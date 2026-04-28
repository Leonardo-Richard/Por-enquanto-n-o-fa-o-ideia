import { consumeAdnRateLimit } from "@/lib/adn-rate-limit";
import { consumeDistributedOrLocalRateLimit } from "@/lib/distributed-rate-limit";

export function getCertUploadRateLimit(): { max: number; windowMs: number } {
  const raw = process.env.CERT_UPLOAD_RATE_MAX_PER_WINDOW?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 5;
  const max = Number.isFinite(n) && n > 0 ? n : 5;
  const windowMinRaw = process.env.CERT_UPLOAD_RATE_WINDOW_MIN?.trim();
  const wm = windowMinRaw ? Number.parseInt(windowMinRaw, 10) : 15;
  const windowMin = Number.isFinite(wm) && wm > 0 ? wm : 15;
  return { max, windowMs: windowMin * 60_000 };
}

export function certUploadPostRateKey(userId: string, organizationId: string, companyId: string): string {
  return `cert-upload:post:${userId}:${organizationId}:${companyId}`;
}

export function consumeCertUploadRateLimit(userId: string, organizationId: string, companyId: string) {
  const { max, windowMs } = getCertUploadRateLimit();
  return consumeAdnRateLimit({
    key: certUploadPostRateKey(userId, organizationId, companyId),
    max,
    windowMs,
  });
}

/** MSYS-06 — mesma política com backend distribuído quando Upstash está configurado. */
export async function consumeCertUploadRateLimitAsync(
  userId: string,
  organizationId: string,
  companyId: string,
) {
  const { max, windowMs } = getCertUploadRateLimit();
  return consumeDistributedOrLocalRateLimit({
    key: certUploadPostRateKey(userId, organizationId, companyId),
    max,
    windowMs,
  });
}

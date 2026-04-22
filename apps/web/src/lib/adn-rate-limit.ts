/**
 * Limitação simples em memória (janela deslizante) para rotas ADN — MVP / dev.
 * Em várias instâncias serverless os contadores não são partilhados.
 */

type Bucket = number[];

const buckets = new Map<string, Bucket>();

/** Usado em testes de integração para não contaminar outros casos com o mesmo actor. */
export function clearAdnRateLimitBucketsForTests(): void {
  buckets.clear();
}

function pruneWindow(ts: number[], windowMs: number, now: number): number[] {
  return ts.filter((t) => now - t < windowMs);
}

export function clientIpFromRequest(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) {
    return cf;
  }
  return "unknown";
}

export function consumeAdnRateLimit(options: {
  key: string;
  max: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const { key, max, windowMs } = options;
  const now = Date.now();
  let arr = buckets.get(key) ?? [];
  arr = pruneWindow(arr, windowMs, now);
  if (arr.length >= max) {
    const oldest = arr[0]!;
    const retryAfterMs = windowMs - (now - oldest);
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    buckets.set(key, arr);
    return { ok: false, retryAfterSec };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true };
}

export function getAdnPublicPostSyncLimit(): { max: number; windowMs: number } {
  const raw = process.env.ADN_PUBLIC_SYNC_RATE_LIMIT_PER_MIN?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 20;
  const max = Number.isFinite(n) && n > 0 ? n : 20;
  return { max, windowMs: 60_000 };
}

export function getAdnInternalRequestLimit(): { max: number; windowMs: number } {
  const raw = process.env.ADN_INTERNAL_RATE_PER_MIN?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 240;
  const max = Number.isFinite(n) && n > 0 ? n : 240;
  return { max, windowMs: 60_000 };
}

export function adnPostSyncRateKey(userId: string, organizationId: string, companyId: string): string {
  return `adn:post-sync:${userId}:${organizationId}:${companyId}`;
}

export function adnInternalIpRateKey(ip: string): string {
  return `adn:internal:${ip}`;
}

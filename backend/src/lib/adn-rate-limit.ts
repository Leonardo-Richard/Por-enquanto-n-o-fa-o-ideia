type Bucket = number[];

const buckets = new Map<string, Bucket>();

function pruneWindow(ts: number[], windowMs: number, now: number): number[] {
  return ts.filter((t) => now - t < windowMs);
}

export function clientIpFromRequest(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
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

export function getAdnInternalRequestLimit(): { max: number; windowMs: number } {
  const raw = process.env.ADN_INTERNAL_RATE_PER_MIN?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 240;
  const max = Number.isFinite(n) && n > 0 ? n : 240;
  return { max, windowMs: 60_000 };
}

export function adnInternalIpRateKey(ip: string): string {
  return `adn:internal:${ip}`;
}

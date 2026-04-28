import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { consumeAdnRateLimit } from "@/lib/adn-rate-limit";

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

const redisSingleton = redisFromEnv();

const limiterCache = new Map<string, Ratelimit>();

function windowLabel(windowMs: number): Duration {
  if (windowMs >= 60_000 && windowMs % 60_000 === 0) {
    const m = windowMs / 60_000;
    return `${m} m` as Duration;
  }
  const s = Math.max(1, Math.ceil(windowMs / 1000));
  return `${s} s` as Duration;
}

function getSlidingLimiter(max: number, windowMs: number): Ratelimit | null {
  if (!redisSingleton) {
    return null;
  }
  const cacheKey = `${max}:${windowMs}`;
  let lim = limiterCache.get(cacheKey);
  if (!lim) {
    lim = new Ratelimit({
      redis: redisSingleton,
      limiter: Ratelimit.slidingWindow(max, windowLabel(windowMs)),
      prefix: `portal:sensitive:${cacheKey}`,
    });
    limiterCache.set(cacheKey, lim);
  }
  return lim;
}

/**
 * MSYS-06 — limite distribuído (Upstash) quando credenciais existem; caso contrário memória (comportamento anterior).
 * `RATE_LIMIT_LOCAL_ONLY=1` força apenas memória (rollback / integração).
 */
export async function consumeDistributedOrLocalRateLimit(options: {
  key: string;
  max: number;
  windowMs: number;
}): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  if (
    process.env.NODE_ENV === "test" ||
    process.env.RATE_LIMIT_LOCAL_ONLY === "1" ||
    !redisSingleton
  ) {
    return consumeAdnRateLimit(options);
  }
  const limiter = getSlidingLimiter(options.max, options.windowMs);
  if (!limiter) {
    return consumeAdnRateLimit(options);
  }
  const out = await limiter.limit(options.key);
  if (out.success) {
    return { ok: true };
  }
  const retryAfterSec = Math.max(1, Math.ceil((out.reset - Date.now()) / 1000));
  return { ok: false, retryAfterSec };
}

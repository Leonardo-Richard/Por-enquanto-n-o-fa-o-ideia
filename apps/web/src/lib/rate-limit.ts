import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function redisOrNull() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

const redis = redisOrNull();

const loginLimit =
  redis &&
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      Number(process.env.RATE_LIMIT_LOGIN_PER_MINUTE ?? 10),
      "1 m",
    ),
    prefix: "portal:login",
  });

const membersSearchLimit =
  redis &&
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      Number(process.env.RATE_LIMIT_MEMBERS_SEARCH_PER_MINUTE ?? 30),
      "1 m",
    ),
    prefix: "portal:members-search",
  });

export async function rateLimitLogin(ip: string): Promise<{ ok: true } | { ok: false }> {
  if (process.env.NODE_ENV === "test" || !loginLimit) {
    return { ok: true };
  }
  const { success } = await loginLimit.limit(ip);
  return success ? { ok: true } : { ok: false };
}

export async function rateLimitMembersSearch(userId: string): Promise<{ ok: true } | { ok: false }> {
  if (process.env.NODE_ENV === "test" || !membersSearchLimit) {
    return { ok: true };
  }
  const { success } = await membersSearchLimit.limit(userId);
  return success ? { ok: true } : { ok: false };
}

import { consumeDistributedOrLocalRateLimit } from "@/lib/distributed-rate-limit";

/**
 * NFR31 — limite mínimo quando `q` está presente no `GET .../members`.
 * Valores: **30** pedidos / **60** s por chave `actorUserId:organizationId`.
 * Usa Upstash quando configurado; caso contrário memória (instância única).
 */
export const ORG_MEMBERS_SEARCH_RATE = { limit: 30, windowSeconds: 60 } as const;

export async function consumeOrgMembersSearchSlot(
  key: string,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  return consumeDistributedOrLocalRateLimit({
    key: `org-members-search:${key}`,
    max: ORG_MEMBERS_SEARCH_RATE.limit,
    windowMs: ORG_MEMBERS_SEARCH_RATE.windowSeconds * 1000,
  });
}

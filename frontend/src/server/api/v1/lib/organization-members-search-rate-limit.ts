/**
 * NFR31 — limite mínimo quando `q` está presente no `GET .../members`.
 * Valores: **30** pedidos / **60** s por chave `actorUserId:organizationId` (documentar no PR).
 * Implementação em memória (instância única); para multi-instância ver Upstash / Redis.
 */
export const ORG_MEMBERS_SEARCH_RATE = { limit: 30, windowSeconds: 60 } as const;

const buckets = new Map<string, number[]>();

export function consumeOrgMembersSearchSlot(key: string): boolean {
  const now = Date.now();
  const windowMs = ORG_MEMBERS_SEARCH_RATE.windowSeconds * 1000;
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= ORG_MEMBERS_SEARCH_RATE.limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

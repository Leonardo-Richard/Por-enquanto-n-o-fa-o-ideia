/**
 * Estado de readiness em memória (processo) — **Persistência readiness: adiada** (UIP-03).
 * Entre *cold starts* o estado não sobrevive; recalcula-se após novo POST verify.
 */

export type ReadinessMemoryEntry = {
  lastCheckedAtIso: string | null;
  /** Instantâneo do portal quando o *probe* devolveu `ok: true` (frescura ≤ 15 min). */
  lastSuccessfulProbeAtIso: string | null;
  /** Último resultado de *probe* após verify: sucesso material do worker. */
  lastProbeMaterialOk: boolean | null;
  lastErrorCode: string | null;
};

const store = new Map<string, ReadinessMemoryEntry>();

export function readinessStoreKey(organizationId: string, companyId: string): string {
  return `${organizationId}:${companyId}`;
}

export function getReadinessMemoryEntry(organizationId: string, companyId: string): ReadinessMemoryEntry | null {
  return store.get(readinessStoreKey(organizationId, companyId)) ?? null;
}

export function setReadinessMemoryEntry(
  organizationId: string,
  companyId: string,
  entry: ReadinessMemoryEntry,
): void {
  store.set(readinessStoreKey(organizationId, companyId), entry);
}

/** Testes — limpar entrada específica. */
export function clearReadinessMemoryEntry(organizationId: string, companyId: string): void {
  store.delete(readinessStoreKey(organizationId, companyId));
}

/** Testes — limpar todo o mapa. */
export function clearAllReadinessMemoryForTests(): void {
  store.clear();
}

/**
 * Contador de GETs `.../adn/sync` no browser (NFR44 / MSYS-04).
 * Em consola: `__portalAdnSyncGetCount` (após interacção com o painel ADN).
 */
const G = globalThis as { __portalAdnSyncGetCount?: number };

export function recordAdnSyncGetRequest(): void {
  G.__portalAdnSyncGetCount = (G.__portalAdnSyncGetCount ?? 0) + 1;
}

export function resetAdnSyncGetCountForTests(): void {
  delete G.__portalAdnSyncGetCount;
}

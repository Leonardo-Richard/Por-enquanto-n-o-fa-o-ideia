import type { OrganizationDirectoryUserItem } from "@repo/shared";
import { classifyThrownFetchError } from "@/lib/fe-api-error";

export type OrganizationSystemUserCatalogFetchResult =
  | { ok: true; items: OrganizationDirectoryUserItem[]; total: number; truncated: boolean }
  | { ok: false; code: "401" }
  | { ok: false; code: "http"; status: number; body: unknown }
  | { ok: false; code: "network" }
  | { ok: false; code: "5xx" };

/**
 * Carrega todas as páginas do catálogo `GET .../system-users` até `total` ou teto NFR37 (100×100).
 * Usado pela página Membros; extraído para testes unitários (incl. cenários de falha de refetch).
 */
export async function fetchOrganizationSystemUserCatalog(
  organizationId: string,
  fetchImpl: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<OrganizationSystemUserCatalogFetchResult> {
  const fetchPageSize = 100;
  const maxPages = 100;
  const acc: OrganizationDirectoryUserItem[] = [];
  let serverTotal = 0;
  try {
    for (let nextPage = 1; nextPage <= maxPages; nextPage++) {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(fetchPageSize),
      });
      const res = await fetchImpl(
        `/api/v1/organizations/${organizationId}/system-users?${params.toString()}`,
        { credentials: "include" },
      );
      const body = (await res.json().catch(() => null)) as unknown;
      if (res.status === 401) {
        return { ok: false, code: "401" };
      }
      if (!res.ok) {
        return { ok: false, code: "http", status: res.status, body };
      }
      const data = body as { items: OrganizationDirectoryUserItem[]; total: number };
      serverTotal = data.total ?? 0;
      const chunk = data.items ?? [];
      acc.push(...chunk);
      if (chunk.length < fetchPageSize || acc.length >= serverTotal) {
        break;
      }
    }
    return {
      ok: true,
      items: acc,
      total: serverTotal,
      truncated: acc.length < serverTotal,
    };
  } catch (e) {
    const net = classifyThrownFetchError(e);
    return { ok: false, code: net === "network" ? "network" : "5xx" };
  }
}

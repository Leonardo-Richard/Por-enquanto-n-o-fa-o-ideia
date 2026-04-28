import { describe, expect, it, vi } from "vitest";
import type { OrganizationDirectoryUserItem } from "@repo/shared";
import { fetchOrganizationSystemUserCatalog } from "./fetch-organization-system-user-catalog";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchOrganizationSystemUserCatalog", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";

  it("agrega páginas até acc.length >= total (uma página)", async () => {
    const u1: OrganizationDirectoryUserItem = {
      userId: "a",
      email: "a@x.pt",
      displayName: "A",
      isSuperadmin: false,
      member: null,
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [u1],
        page: 1,
        pageSize: 100,
        total: 1,
      }),
    );
    const r = await fetchOrganizationSystemUserCatalog(orgId, fetchImpl);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(1);
      expect(r.total).toBe(1);
      expect(r.truncated).toBe(false);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("pede segunda página quando a primeira vem cheia e total > pageSize", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      userId: `u${i}`,
      email: `u${i}@x.pt`,
      displayName: `U${i}`,
      isSuperadmin: false,
      member: null,
    })) satisfies OrganizationDirectoryUserItem[];
    const page2Item: OrganizationDirectoryUserItem = {
      userId: "last",
      email: "last@x.pt",
      displayName: "Last",
      isSuperadmin: false,
      member: null,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ items: page1, page: 1, pageSize: 100, total: 101 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [page2Item], page: 2, pageSize: 100, total: 101 }),
      );
    const r = await fetchOrganizationSystemUserCatalog(orgId, fetchImpl);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(101);
      expect(r.truncated).toBe(false);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("truncated true quando o teto de páginas não cobre total (100×100 vs total 10001)", async () => {
    const fetchImpl = vi.fn((path: string) => {
      const u = new URL("http://x" + path);
      const p = Number(u.searchParams.get("page") ?? "1");
      const items = Array.from({ length: 100 }, (_, i) => ({
        userId: `p${p}_u${i}`,
        email: `p${p}_u${i}@x.pt`,
        displayName: `P${p}`,
        isSuperadmin: false,
        member: null,
      })) satisfies OrganizationDirectoryUserItem[];
      return Promise.resolve(jsonResponse({ items, page: p, pageSize: 100, total: 10_001 }));
    });
    const r = await fetchOrganizationSystemUserCatalog(orgId, fetchImpl);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(10_000);
      expect(r.truncated).toBe(true);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(100);
  });

  it("401 → ok false code 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const r = await fetchOrganizationSystemUserCatalog(orgId, fetchImpl);
    expect(r).toEqual({ ok: false, code: "401" });
  });

  it("5xx na primeira página → ok false http", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "x" }, 503));
    const r = await fetchOrganizationSystemUserCatalog(orgId, fetchImpl);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("http");
      if (r.code === "http") {
        expect(r.status).toBe(503);
      }
    }
  });

  it("rede (fetch rejeita) → ok false network", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await fetchOrganizationSystemUserCatalog(orgId, fetchImpl);
    expect(r).toEqual({ ok: false, code: "network" });
  });
});

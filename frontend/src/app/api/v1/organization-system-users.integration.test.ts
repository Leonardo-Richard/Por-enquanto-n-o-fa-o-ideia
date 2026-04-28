/**
 * SMEM-09 — GET .../system-users (superadmin, catálogo global + vínculo opcional).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { count, eq, inArray } from "drizzle-orm";
import { auditEvents, organizationMemberships, organizations, user } from "@repo/db";
import { getDb } from "@/lib/db";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { GET as getSystemUsers } from "@/app/api/v1/organizations/[organizationId]/system-users/route";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("API /api/v1/organizations/.../system-users (integração)", () => {
  const prefix = `sysu_${Date.now()}_`;
  const orgId = randomUUID();
  const ids = {
    superUser: `u_${prefix}super`,
    normalUser: `u_${prefix}norm`,
    userMember: `u_${prefix}mem`,
    userNonMember: `u_${prefix}non`,
    userOrderOld: `u_${prefix}old`,
    userOrderNew: `u_${prefix}new`,
    sessionSuper: `sess_${prefix}s`,
  };

  function mockSuperSession() {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.superUser,
        email: `${prefix}super@itest.local`,
        name: "Super",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: true,
      },
      session: {
        id: ids.sessionSuper,
        userId: ids.superUser,
        expiresAt: new Date(),
        token: `${prefix}tok`,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: null,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);
  }

  function mockNormalUserSession() {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.normalUser,
        email: `${prefix}norm@itest.local`,
        name: "Norm",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s_n",
        userId: ids.normalUser,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: null,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);
  }

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    const db = getDb();
    const tOld = new Date("2140-01-01T12:00:00.000Z");
    const tNew = new Date("2140-06-15T12:00:00.000Z");
    await db.insert(user).values([
      {
        id: ids.superUser,
        name: "Super SU",
        email: `${prefix}super@itest.local`,
        emailVerified: true,
        isSuperadmin: true,
      },
      {
        id: ids.normalUser,
        name: "Norm SU",
        email: `${prefix}norm@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.userMember,
        name: "Member User",
        email: `${prefix}mem@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.userNonMember,
        name: "Non Member",
        email: `${prefix}non@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.userOrderOld,
        name: "Order Old",
        email: `${prefix}old@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
        createdAt: tOld,
        updatedAt: tOld,
      },
      {
        id: ids.userOrderNew,
        name: "Order New",
        email: `${prefix}new@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
        createdAt: tNew,
        updatedAt: tNew,
      },
    ]);
    await db.insert(organizations).values({ id: orgId, name: `Org ${prefix}`, active: true });
    await db.insert(organizationMemberships).values([
      { organizationId: orgId, userId: ids.superUser, orgRole: "admin" },
      { organizationId: orgId, userId: ids.userMember, orgRole: "user" },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, orgId));
    await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(user).where(
      inArray(user.id, [
        ids.superUser,
        ids.normalUser,
        ids.userMember,
        ids.userNonMember,
        ids.userOrderOld,
        ids.userOrderNew,
      ]),
    );
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
  });

  it("GET sem sessão retorna 401", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue(null);
    const res = await getSystemUsers(new Request(`http://test/api/v1/organizations/${orgId}/system-users?page=1`), {
      params: Promise.resolve({ organizationId: orgId }),
    });
    expect(res.status).toBe(401);
  });

  it("GET utilizador não superadmin retorna 403", async () => {
    mockNormalUserSession();
    const res = await getSystemUsers(new Request(`http://test/api/v1/organizations/${orgId}/system-users?page=1`), {
      params: Promise.resolve({ organizationId: orgId }),
    });
    expect(res.status).toBe(403);
  });

  it("GET organizationId inválido retorna 400", async () => {
    mockSuperSession();
    const res = await getSystemUsers(new Request(`http://test/api/v1/organizations/not-uuid/system-users`), {
      params: Promise.resolve({ organizationId: "not-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET query page inválida retorna 400", async () => {
    mockSuperSession();
    const res = await getSystemUsers(
      new Request(`http://test/api/v1/organizations/${orgId}/system-users?page=0&pageSize=10`),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res.status).toBe(400);
  });

  it("GET query pageSize > 100 retorna 400", async () => {
    mockSuperSession();
    const res = await getSystemUsers(
      new Request(`http://test/api/v1/organizations/${orgId}/system-users?page=1&pageSize=101`),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res.status).toBe(400);
  });

  it("GET com q filtra por e-mail/nome e ajusta total (MSYS-03)", async () => {
    mockSuperSession();
    const q = encodeURIComponent(`${prefix}mem`);
    const res = await getSystemUsers(
      new Request(`http://test/api/v1/organizations/${orgId}/system-users?page=1&pageSize=50&q=${q}`),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { userId: string; email: string }[];
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.some((i) => i.userId === ids.userMember)).toBe(true);
  });

  it("GET organização inexistente retorna 404", async () => {
    mockSuperSession();
    const missing = randomUUID();
    const res = await getSystemUsers(new Request(`http://test/api/v1/organizations/${missing}/system-users?page=1`), {
      params: Promise.resolve({ organizationId: missing }),
    });
    expect(res.status).toBe(404);
  });

  it("GET superadmin 200: membro vs não membro, campos mínimos, sem duplicados user.id", async () => {
    mockSuperSession();
    const res = await getSystemUsers(
      new Request(`http://test/api/v1/organizations/${orgId}/system-users?page=1&pageSize=100`),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        userId: string;
        email: string;
        displayName: string;
        isSuperadmin: boolean;
        member: unknown;
      }>;
      page: number;
      pageSize: number;
      total: number;
    };
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(100);
    expect(typeof body.total).toBe("number");

    const db = getDb();
    const [countRow] = await db.select({ c: count() }).from(user);
    expect(body.total).toBe(Number(countRow?.c ?? 0));

    const byId = new Map(body.items.map((i) => [i.userId, i]));
    expect(byId.get(ids.userMember)?.member).not.toBeNull();
    expect(byId.get(ids.userNonMember)?.member).toBeNull();

    const seen = new Set<string>();
    for (const it of body.items) {
      expect(it.userId).toBeTruthy();
      expect(it.email).toContain("@");
      expect(typeof it.displayName).toBe("string");
      expect(typeof it.isSuperadmin).toBe("boolean");
      expect("member" in it).toBe(true);
      expect(seen.has(it.userId)).toBe(false);
      seen.add(it.userId);
    }
  });

  it("GET ordenação: user.createdAt DESC (índice global ao percorrer páginas até total)", async () => {
    mockSuperSession();
    const orderedIds: string[] = [];
    let page = 1;
    while (page <= 100) {
      const res = await getSystemUsers(
        new Request(
          `http://test/api/v1/organizations/${orgId}/system-users?page=${page}&pageSize=100`,
        ),
        { params: Promise.resolve({ organizationId: orgId }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: { userId: string }[]; total: number };
      for (const it of body.items) {
        orderedIds.push(it.userId);
      }
      if (body.items.length < 100 || orderedIds.length >= body.total) {
        break;
      }
      page += 1;
    }
    const idxNew = orderedIds.indexOf(ids.userOrderNew);
    const idxOld = orderedIds.indexOf(ids.userOrderOld);
    expect(idxNew).toBeGreaterThanOrEqual(0);
    expect(idxOld).toBeGreaterThanOrEqual(0);
    expect(idxNew).toBeLessThan(idxOld);
  });

  it("sucesso regista log estruturado com scope organization_system_users", async () => {
    mockSuperSession();
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await getSystemUsers(
      new Request(`http://test/api/v1/organizations/${orgId}/system-users?page=1&pageSize=5`),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res.status).toBe(200);
    const logged = spy.mock.calls.some((args) => {
      const line = typeof args[0] === "string" ? args[0] : "";
      return (
        line.includes("organization_system_users") &&
        line.includes("outcome") &&
        line.includes("success")
      );
    });
    expect(logged).toBe(true);
    spy.mockRestore();
  });
});

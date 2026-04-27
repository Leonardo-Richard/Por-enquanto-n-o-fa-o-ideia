/**
 * SORG-01 / SORG-02 / SORG-05 / SORG-06 — POST /api/v1/organizations (integração com Postgres).
 * Estratégia AC10 ramo `true` (SORG-06): teste de módulo `hasOrganizationLocalAdmin` com fixture de membership
 * (documentado como AC11-equivalente quando HTTP do ramo `true` não é reprodutível sem trigger).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  auditEvents,
  organizationMemberships,
  organizations,
  session,
  user,
} from "@repo/db";
import { getDb } from "@/lib/db";
import { hasOrganizationLocalAdmin } from "@/server/api/v1/lib/organization-local-admin";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { GET as getOrganizationsAccessible } from "@/app/api/v1/organizations/accessible/route";
import { POST as postOrganizations } from "@/app/api/v1/organizations/route";
import { POST as postActiveOrganization } from "@/app/api/v1/session/active-organization/route";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("API POST /api/v1/organizations (integração)", () => {
  const prefix = `orgpost_${Date.now()}_`;
  const ids = {
    superUser: `u_${prefix}super`,
    normalUser: `u_${prefix}norm`,
    dupOrg: randomUUID(),
    sessionSuper: `sess_${prefix}s`,
    dupTax: "99888777000199",
  };

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    const db = getDb();
    await db.insert(user).values([
      {
        id: ids.superUser,
        name: "Super IT",
        email: `${prefix}super@itest.local`,
        emailVerified: true,
        isSuperadmin: true,
      },
      {
        id: ids.normalUser,
        name: "Norm IT",
        email: `${prefix}norm@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
    ]);

    await db.insert(organizations).values({
      id: ids.dupOrg,
      name: "Org duplicado CNPJ",
      taxIdDigits: ids.dupTax,
      active: true,
    });

    await db.insert(session).values({
      id: ids.sessionSuper,
      expiresAt: new Date(Date.now() + 86_400_000),
      token: `${prefix}tok_super`,
      userId: ids.superUser,
      activeCompanyId: null,
      activeOrganizationId: null,
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(session).where(eq(session.id, ids.sessionSuper));
    await db.delete(auditEvents).where(eq(auditEvents.actorUserId, ids.superUser));
    await db.delete(organizations).where(eq(organizations.id, ids.dupOrg));
    await db.delete(user).where(inArray(user.id, [ids.superUser, ids.normalUser]));
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
  });

  function mockSuperSession() {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.superUser,
        email: "s@x",
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
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: null,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);
  }

  it("superadmin cria organização (201) com localAdminLinked false", async () => {
    mockSuperSession();
    const res = await postOrganizations(
      new Request("http://test/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Org criada ${prefix}`, tradeName: "Fantasia", taxIdDigits: null }),
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      id: string;
      localAdminLinked: boolean;
      name: string;
      tradeName: string | null;
      taxIdMasked: string | null;
      createdAt: string;
    };
    expect(json.localAdminLinked).toBe(false);
    expect(json.name).toContain("Org criada");

    const db = getDb();
    const [ev] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, json.id),
          eq(auditEvents.eventType, "organization_created_by_superadmin"),
        ),
      )
      .limit(1);
    expect(ev?.actorUserId).toBe(ids.superUser);
    expect((ev?.metadata as { source?: string }).source).toBe("api");

    await db.delete(auditEvents).where(eq(auditEvents.organizationId, json.id));
    await db.delete(organizations).where(eq(organizations.id, json.id));
  });

  it("GET /organizations/accessible inclui a org após POST (regressão SORG-06 AC8)", async () => {
    mockSuperSession();
    const create = await postOrganizations(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Lista ${prefix}` }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: string };

    const list = await getOrganizationsAccessible(
      new Request("http://test/api/v1/organizations/accessible?page=1&pageSize=100"),
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { items: { id: string }[] };
    expect(body.items?.some((o) => o.id === created.id)).toBe(true);

    const db = getDb();
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, created.id));
    await db.delete(organizations).where(eq(organizations.id, created.id));
  });

  it("payload inválido (nome vazio) retorna 400", async () => {
    mockSuperSession();
    const res = await postOrganizations(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("taxIdDigits com tamanho inválido retorna 400", async () => {
    mockSuperSession();
    const res = await postOrganizations(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X", taxIdDigits: "123" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("sem sessão retorna 401", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue(null);
    const res = await postOrganizations(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("utilizador sem superadmin retorna 403", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.normalUser,
        email: "n@x",
        name: "Norm",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s_norm",
        userId: ids.normalUser,
        expiresAt: new Date(),
        token: "t2",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: null,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await postOrganizations(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hacker org" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("CNPJ duplicado retorna 409", async () => {
    mockSuperSession();
    const res = await postOrganizations(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dup test", taxIdDigits: ids.dupTax }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("após criar, superadmin pode ativar organização via active-organization", async () => {
    mockSuperSession();
    const res = await postOrganizations(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Ativa ${prefix}` }),
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string };
    const act = await postActiveOrganization(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: json.id }),
      }),
    );
    expect(act.status).toBe(204);

    const db = getDb();
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, json.id));
    await db.delete(organizations).where(eq(organizations.id, json.id));
  });
});

describe.skipIf(!hasDb)("hasOrganizationLocalAdmin (domínio — SORG-06 AC10/11)", () => {
  const prefix = `la_${Date.now()}_`;
  const orgId = randomUUID();
  const userId = `u_${prefix}m`;

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    const db = getDb();
    await db.insert(user).values({
      id: userId,
      name: "M",
      email: `${prefix}m@itest.local`,
      emailVerified: true,
      isSuperadmin: false,
    });
    await db.insert(organizations).values({ id: orgId, name: "LA test", active: true });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(user).where(eq(user.id, userId));
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
  });

  it("retorna true quando existe membership org_role admin", async () => {
    const db = getDb();
    expect(await hasOrganizationLocalAdmin(db, orgId)).toBe(false);
    await db.insert(organizationMemberships).values({
      organizationId: orgId,
      userId,
      orgRole: "admin",
    });
    expect(await hasOrganizationLocalAdmin(db, orgId)).toBe(true);
    await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, orgId));
  });
});

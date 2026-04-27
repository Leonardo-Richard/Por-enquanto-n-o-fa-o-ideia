/**
 * Integração contra Postgres real (DATABASE_URL).
 * Em CI/local sem base, o bloco é ignorado (skipIf).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  auditEvents,
  companies,
  companyMemberships,
  organizationMemberships,
  organizations,
  session,
  user,
} from "@repo/db";
import { getDb } from "@/lib/db";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { GET as getCompany } from "@/app/api/v1/companies/[companyId]/route";
import { PATCH as patchCompany } from "@/app/api/v1/companies/[companyId]/route";
import { GET as getMembers } from "@/app/api/v1/companies/[companyId]/members/route";
import { PATCH as patchMember } from "@/app/api/v1/companies/[companyId]/members/[userId]/route";
import { DELETE as deleteMember } from "@/app/api/v1/companies/[companyId]/members/[userId]/route";
import { GET as getMonitoredCompanies } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/route";
import { POST as postActiveOrganization } from "@/app/api/v1/session/active-organization/route";
import { POST as postActiveCompany } from "@/app/api/v1/session/active-company/route";
import {
  DELETE as deleteOrgMember,
  PATCH as patchOrgMember,
} from "@/app/api/v1/organizations/[organizationId]/members/[userId]/route";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("API /api/v1/companies (integração)", () => {
  const prefix = `itest_${Date.now()}_`;
  const ids = {
    alice: `u_${prefix}alice`,
    bob: `u_${prefix}bob`,
    carol: `u_${prefix}carol`,
    dave: `u_${prefix}dave`,
    orgA: randomUUID(),
    orgB: randomUUID(),
    companyA: randomUUID(),
    companyB: randomUUID(),
    sessionAc: `sess_${prefix}ac`,
  };

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    const db = getDb();

    await db.insert(user).values([
      {
        id: ids.alice,
        name: "Alice",
        email: `${prefix}alice@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.bob,
        name: "Bob",
        email: `${prefix}bob@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.carol,
        name: "Carol",
        email: `${prefix}carol@itest.local`,
        emailVerified: true,
        isSuperadmin: true,
      },
      {
        id: ids.dave,
        name: "Dave",
        email: `${prefix}dave@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
    ]);

    await db.insert(organizations).values([
      { id: ids.orgA, name: "Org A IT", active: true },
      { id: ids.orgB, name: "Org B IT", active: true },
    ]);

    await db.insert(companies).values([
      {
        id: ids.companyA,
        organizationId: ids.orgA,
        cnpjDigits: "11222333000181",
        tradeName: "Empresa A",
        systemCode: "sys-a",
        monthlyRunDay: 1,
        accountId: ids.alice,
      },
      {
        id: ids.companyB,
        organizationId: ids.orgB,
        cnpjDigits: "04252011000110",
        tradeName: "Empresa B",
        systemCode: "sys-b",
        monthlyRunDay: 1,
        accountId: ids.bob,
      },
    ]);

    await db.insert(organizationMemberships).values([
      { organizationId: ids.orgA, userId: ids.alice, orgRole: "admin" },
      { organizationId: ids.orgA, userId: ids.dave, orgRole: "admin" },
      { organizationId: ids.orgB, userId: ids.bob, orgRole: "admin" },
    ]);

    await db.insert(companyMemberships).values([
      { companyId: ids.companyA, userId: ids.alice, companyRole: "admin" },
      { companyId: ids.companyB, userId: ids.bob, companyRole: "admin" },
    ]);

    await db.insert(session).values({
      id: ids.sessionAc,
      expiresAt: new Date(Date.now() + 86_400_000),
      token: `${prefix}tok_sess_ac`,
      userId: ids.alice,
      activeCompanyId: null,
      activeOrganizationId: null,
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(session).where(eq(session.id, ids.sessionAc));

    const userIds = [ids.alice, ids.bob, ids.carol, ids.dave];
    const companyIds = [ids.companyA, ids.companyB];
    const orgIds = [ids.orgA, ids.orgB];

    await db.delete(auditEvents).where(
      or(
        inArray(auditEvents.actorUserId, userIds),
        inArray(auditEvents.companyId, companyIds),
        inArray(auditEvents.organizationId, orgIds),
      ),
    );
    await db.delete(companyMemberships).where(
      inArray(companyMemberships.companyId, companyIds),
    );
    await db.delete(companies).where(inArray(companies.id, companyIds));
    await db.delete(organizationMemberships).where(
      inArray(organizationMemberships.organizationId, orgIds),
    );
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
    await db.delete(user).where(inArray(user.id, userIds));
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
  });

  it("utilizador sem vínculo recebe 404 ao GET empresa alheia", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.alice,
        email: "a@x",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s1",
        userId: ids.alice,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: ids.orgA,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getCompany(new Request("http://test/"), {
      params: Promise.resolve({ companyId: ids.companyB }),
    });
    expect(res.status).toBe(404);
  });

  it("utilizador com papel user recebe 403 ao GET membros", async () => {
    await getDb().insert(companyMemberships).values({
      companyId: ids.companyB,
      userId: ids.alice,
      companyRole: "user",
    });

    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.alice,
        email: "a@x",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s1",
        userId: ids.alice,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyB,
        activeOrganizationId: ids.orgB,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getMembers(
      new Request("http://test/?page=1&pageSize=20"),
      { params: Promise.resolve({ companyId: ids.companyB }) },
    );
    expect(res.status).toBe(403);

    await getDb()
      .delete(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, ids.companyB),
          eq(companyMemberships.userId, ids.alice),
        ),
      );
  });

  it("superadmin sem membership não faz PATCH de dados de negócio (403)", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.carol,
        email: "c@x",
        name: "Carol",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: true,
      },
      session: {
        id: "s2",
        userId: ids.carol,
        expiresAt: new Date(),
        token: "t2",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: null,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await patchCompany(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeName: "Novo nome" }),
      }),
      { params: Promise.resolve({ companyId: ids.companyA }) },
    );
    expect(res.status).toBe(403);
  });

  it("PATCH último admin para user → 409", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.bob,
        email: "b@x",
        name: "Bob",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s3",
        userId: ids.bob,
        expiresAt: new Date(),
        token: "t3",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyB,
        activeOrganizationId: ids.orgB,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await patchMember(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyRole: "user" }),
      }),
      {
        params: Promise.resolve({
          companyId: ids.companyB,
          userId: ids.bob,
        }),
      },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("last_admin");
  });

  it("DELETE último admin → 409", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.bob,
        email: "b@x",
        name: "Bob",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s3",
        userId: ids.bob,
        expiresAt: new Date(),
        token: "t3",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyB,
        activeOrganizationId: ids.orgB,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await deleteMember(new Request("http://test/"), {
      params: Promise.resolve({
        companyId: ids.companyB,
        userId: ids.bob,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("membro só da org A não obtém 200 ao listar empresas monitoradas da org B (403)", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.alice,
        email: "a@x",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-org",
        userId: ids.alice,
        expiresAt: new Date(),
        token: "t-org",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: ids.orgA,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getMonitoredCompanies(new Request("http://test/?page=1&pageSize=20"), {
      params: Promise.resolve({ organizationId: ids.orgB }),
    });
    expect(res.status).toBe(403);
  });

  it("POST active-organization sem membership na org X → 403", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.alice,
        email: "a@x",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-act",
        userId: ids.alice,
        expiresAt: new Date(),
        token: "t-act",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: null,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await postActiveOrganization(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: ids.orgB }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("PATCH último admin da organização → 409", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.bob,
        email: "b@x",
        name: "Bob",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-org-patch",
        userId: ids.bob,
        expiresAt: new Date(),
        token: "t-org-patch",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyB,
        activeOrganizationId: ids.orgB,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await patchOrgMember(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyRole: "user" }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgB, userId: ids.bob }) },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("last_admin");
  });

  it("DELETE último admin da organização → 409", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.bob,
        email: "b@x",
        name: "Bob",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-org-del",
        userId: ids.bob,
        expiresAt: new Date(),
        token: "t-org-del",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyB,
        activeOrganizationId: ids.orgB,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await deleteOrgMember(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgB, userId: ids.bob }),
    });
    expect(res.status).toBe(409);
  });

  it("POST active-company persiste activeOrganizationId na sessão (ORG-03)", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.alice,
        email: "a@x",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: ids.sessionAc,
        userId: ids.alice,
        expiresAt: new Date(),
        token: "t-ac",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: null,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await postActiveCompany(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: ids.companyA }),
      }),
    );
    expect(res.status).toBe(200);

    const db = getDb();
    const [row] = await db.select().from(session).where(eq(session.id, ids.sessionAc)).limit(1);
    expect(row?.activeCompanyId).toBe(ids.companyA);
    expect(row?.activeOrganizationId).toBe(ids.orgA);

    await db
      .update(session)
      .set({ activeCompanyId: null, activeOrganizationId: null, updatedAt: new Date() })
      .where(eq(session.id, ids.sessionAc));
  });

  it("admin só na organização (sem company_membership) pode GET empresa da org", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.dave,
        email: "d@x",
        name: "Dave",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-dave",
        userId: ids.dave,
        expiresAt: new Date(),
        token: "t-dave",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: ids.orgA,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getCompany(new Request("http://test/"), {
      params: Promise.resolve({ companyId: ids.companyA }),
    });
    expect(res.status).toBe(200);
  });
});

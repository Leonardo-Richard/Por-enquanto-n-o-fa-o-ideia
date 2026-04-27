/**
 * SMEM-02 … SMEM-05 / SMEM-08 — membros da organização (superadmin) + regressão mínima SORG.
 * SMEM-05 AC4: o teste `POST create` usa `verifyPassword` sobre o hash — substituto inequívoco ao fluxo HTTP sign-in (Better Auth).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";
import { account, auditEvents, organizationMemberships, organizations, user } from "@repo/db";
import { getDb } from "@/lib/db";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { GET as getOrganizationsAccessible } from "@/app/api/v1/organizations/accessible/route";
import { POST as postOrganizations } from "@/app/api/v1/organizations/route";
import { GET as getMembers, POST as postMembers } from "@/app/api/v1/organizations/[organizationId]/members/route";
import {
  DELETE as deleteMember,
  PATCH as patchMember,
} from "@/app/api/v1/organizations/[organizationId]/members/[membershipId]/route";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("API /api/v1/organizations/.../members (integração)", () => {
  const prefix = `mem_${Date.now()}_`;
  const orgId = randomUUID();
  const ids = {
    superUser: `u_${prefix}super`,
    normalUser: `u_${prefix}norm`,
    userA: `u_${prefix}a`,
    userB: `u_${prefix}b`,
    sessionSuper: `sess_${prefix}s`,
  };
  let superMembershipId: string;
  let userAMembershipId: string;

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
    await db.insert(user).values([
      {
        id: ids.superUser,
        name: "Super M",
        email: `${prefix}super@itest.local`,
        emailVerified: true,
        isSuperadmin: true,
      },
      {
        id: ids.normalUser,
        name: "Norm M",
        email: `${prefix}norm@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.userA,
        name: "User A",
        email: `${prefix}a@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.userB,
        name: "User B",
        email: `${prefix}b@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
    ]);
    await db.insert(organizations).values({ id: orgId, name: `Org ${prefix}`, active: true });
    const [mSuper] = await db
      .insert(organizationMemberships)
      .values({ organizationId: orgId, userId: ids.superUser, orgRole: "admin" })
      .returning({ id: organizationMemberships.id });
    const [mA] = await db
      .insert(organizationMemberships)
      .values({ organizationId: orgId, userId: ids.userA, orgRole: "admin" })
      .returning({ id: organizationMemberships.id });
    superMembershipId = mSuper!.id;
    userAMembershipId = mA!.id;
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, orgId));
    await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(user).where(inArray(user.id, [ids.superUser, ids.normalUser, ids.userA, ids.userB]));
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
  });

  it("GET membros superadmin retorna 200 com itens", async () => {
    mockSuperSession();
    const res = await getMembers(new Request(`http://test/api/v1/organizations/${orgId}/members?page=1`), {
      params: Promise.resolve({ organizationId: orgId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { membershipId: string; email: string }[]; total: number };
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.items.some((i) => i.email === `${prefix}super@itest.local`)).toBe(true);
  });

  it("GET membros sem sessão retorna 401", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue(null);
    const res = await getMembers(new Request(`http://test/api/v1/organizations/${orgId}/members?page=1`), {
      params: Promise.resolve({ organizationId: orgId }),
    });
    expect(res.status).toBe(401);
  });

  it("GET membros utilizador normal retorna 403", async () => {
    mockNormalUserSession();

    const res = await getMembers(new Request(`http://test/${orgId}/members`), {
      params: Promise.resolve({ organizationId: orgId }),
    });
    expect(res.status).toBe(403);
  });

  it("GET organização inexistente retorna 404", async () => {
    mockSuperSession();
    const missing = randomUUID();
    const res = await getMembers(new Request(`http://test/${missing}/members`), {
      params: Promise.resolve({ organizationId: missing }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH jobTitle retorna 200 com corpo alinhado ao item da lista", async () => {
    mockSuperSession();
    const res = await patchMember(
      new Request(`http://test/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: "Auditor QA" }),
      }),
      { params: Promise.resolve({ organizationId: orgId, membershipId: userAMembershipId }) },
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { membershipId?: string; jobTitle?: string | null; email?: string };
    expect(j.membershipId).toBe(userAMembershipId);
    expect(j.jobTitle).toBe("Auditor QA");
    expect(j.email).toBe(`${prefix}a@itest.local`);
  });

  it("PATCH membership_id de outra organização retorna 404", async () => {
    const db = getDb();
    const orgOther = randomUUID();
    const userC = `u_${prefix}c`;
    try {
      await db.insert(user).values({
        id: userC,
        name: "User C",
        email: `${prefix}c@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      });
      await db.insert(organizations).values({ id: orgOther, name: `Org outra ${prefix}`, active: true });
      const [m] = await db
        .insert(organizationMemberships)
        .values({ organizationId: orgOther, userId: userC, orgRole: "admin" })
        .returning({ id: organizationMemberships.id });

      mockSuperSession();
      const res = await patchMember(
        new Request(`http://test/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobTitle: "X" }),
        }),
        { params: Promise.resolve({ organizationId: orgId, membershipId: m!.id }) },
      );
      expect(res.status).toBe(404);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.organizationId, orgOther));
      await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, orgOther));
      await db.delete(organizations).where(eq(organizations.id, orgOther));
      await db.delete(user).where(eq(user.id, userC));
    }
  });

  it("POST link utilizador normal retorna 403", async () => {
    mockNormalUserSession();
    const res = await postMembers(
      new Request(`http://test/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "link",
          email: `${prefix}norm@itest.local`,
          orgRole: "user",
        }),
      }),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res.status).toBe(403);
  });

  it("PATCH membros utilizador normal retorna 403", async () => {
    mockNormalUserSession();
    const res = await patchMember(
      new Request(`http://test/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: "Y" }),
      }),
      { params: Promise.resolve({ organizationId: orgId, membershipId: userAMembershipId }) },
    );
    expect(res.status).toBe(403);
  });

  it("DELETE membros utilizador normal retorna 403", async () => {
    mockNormalUserSession();
    const res = await deleteMember(new Request(`http://test/`, { method: "DELETE" }), {
      params: Promise.resolve({ organizationId: orgId, membershipId: userAMembershipId }),
    });
    expect(res.status).toBe(403);
  });

  it("POST link 201 e 409 duplicado e 400 USER_NOT_FOUND", async () => {
    mockSuperSession();
    const res201 = await postMembers(
      new Request(`http://test/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "link",
          email: `${prefix}b@itest.local`,
          orgRole: "user",
        }),
      }),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res201.status).toBe(201);

    const resDup = await postMembers(
      new Request(`http://test/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "link",
          email: `${prefix}b@itest.local`,
          orgRole: "user",
        }),
      }),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(resDup.status).toBe(409);
    const dupBody = (await resDup.json()) as { code?: string };
    expect(dupBody.code).toBe("MEMBERSHIP_DUPLICATE");

    const res404user = await postMembers(
      new Request(`http://test/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "link",
          email: "nao_existe_membro@itest.local",
          orgRole: "user",
        }),
      }),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res404user.status).toBe(400);
    const nf = (await res404user.json()) as { code?: string };
    expect(nf.code).toBe("USER_NOT_FOUND");
  });

  it("DELETE membership de utilizador user retorna 204", async () => {
    mockSuperSession();
    const db = getDb();
    const [row] = await db
      .select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.userId, ids.userB), eq(organizationMemberships.organizationId, orgId)))
      .limit(1);
    expect(row?.id).toBeTruthy();
    const res = await deleteMember(new Request(`http://test/`, { method: "DELETE" }), {
      params: Promise.resolve({ organizationId: orgId, membershipId: row!.id }),
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("PATCH último admin retorna 409 LAST_ORG_ADMIN", async () => {
    mockSuperSession();
    const demoteA = await patchMember(
      new Request(`http://test/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRole: "user" }),
      }),
      { params: Promise.resolve({ organizationId: orgId, membershipId: userAMembershipId }) },
    );
    expect(demoteA.status).toBe(200);

    const resLast = await patchMember(
      new Request(`http://test/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRole: "user" }),
      }),
      { params: Promise.resolve({ organizationId: orgId, membershipId: superMembershipId }) },
    );
    expect(resLast.status).toBe(409);
    const j = (await resLast.json()) as { code?: string };
    expect(j.code).toBe("LAST_ORG_ADMIN");

    await patchMember(
      new Request(`http://test/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRole: "admin" }),
      }),
      { params: Promise.resolve({ organizationId: orgId, membershipId: userAMembershipId }) },
    );
  });

  it("DELETE último admin retorna 409", async () => {
    mockSuperSession();
    await patchMember(
      new Request(`http://test/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRole: "user" }),
      }),
      { params: Promise.resolve({ organizationId: orgId, membershipId: userAMembershipId }) },
    );
    const res = await deleteMember(new Request(`http://test/`, { method: "DELETE" }), {
      params: Promise.resolve({ organizationId: orgId, membershipId: superMembershipId }),
    });
    expect(res.status).toBe(409);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("LAST_ORG_ADMIN");
    await patchMember(
      new Request(`http://test/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRole: "admin" }),
      }),
      { params: Promise.resolve({ organizationId: orgId, membershipId: userAMembershipId }) },
    );
  });

  it("POST create 201 e palavra-passe verifica com Better Auth", async () => {
    mockSuperSession();
    const pw = "SenhaSegura8!";
    const emailCreate = `${prefix}create@itest.local`;
    const res = await postMembers(
      new Request(`http://test/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          email: emailCreate,
          password: pw,
          name: "Criado Teste",
          orgRole: "user",
        }),
      }),
      { params: Promise.resolve({ organizationId: orgId }) },
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { userId: string };
    const db = getDb();
    const [acc] = await db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, created.userId), eq(account.providerId, "credential")))
      .limit(1);
    expect(acc?.password).toBeTruthy();
    expect(await verifyPassword({ hash: acc!.password!, password: pw })).toBe(true);

    await db.delete(organizationMemberships).where(eq(organizationMemberships.userId, created.userId));
    await db.delete(account).where(eq(account.userId, created.userId));
    await db.delete(user).where(eq(user.id, created.userId));
  });

  it("regressão SORG: POST /api/v1/organizations continua a criar (SMEM-08 AC3)", async () => {
    mockSuperSession();
    const createdName = `SORG regressão SMEM ${prefix}`;
    const res = await postOrganizations(
      new Request("http://test/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createdName }),
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string; name: string };
    expect(json.name).toBe(createdName);
    const db = getDb();
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, json.id));
    await db.delete(organizations).where(eq(organizations.id, json.id));
  });

  it("regressão SORG: GET /organizations/accessible continua a responder", async () => {
    mockSuperSession();
    const list = await getOrganizationsAccessible(
      new Request("http://test/api/v1/organizations/accessible?page=1&pageSize=100"),
    );
    expect(list.status).toBe(200);
  });
});

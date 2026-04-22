/**
 * Integração Postgres real (DATABASE_URL) — rotas públicas ADN (sync, retry-bulk).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  adnSyncJobs,
  auditEvents,
  companies,
  companyMemberships,
  organizationMemberships,
  organizations,
  user,
} from "@repo/db";
import { clearAdnRateLimitBucketsForTests } from "@/lib/adn-rate-limit";
import { getDb } from "@/lib/db";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { GET as getAdnSync, POST as postAdnSync } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/sync/route";
import { POST as postRetryBulk } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/failures/retry-bulk/route";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("API ADN pública (integração)", () => {
  const prefix = `adn_it_${Date.now()}_`;
  const ids = {
    adminOn: `u_${prefix}admin_on`,
    adminOff: `u_${prefix}admin_off`,
    orgUser: `u_${prefix}org_user`,
    stranger: `u_${prefix}stranger`,
    superSa: `u_${prefix}super_sa`,
    orgOn: randomUUID(),
    orgOff: randomUUID(),
    companyOn: randomUUID(),
    companyOff: randomUUID(),
  };

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    const db = getDb();

    await db.insert(user).values([
      {
        id: ids.adminOn,
        name: "Admin On",
        email: `${prefix}admin_on@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.adminOff,
        name: "Admin Off",
        email: `${prefix}admin_off@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.orgUser,
        name: "Org User",
        email: `${prefix}org_user@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.stranger,
        name: "Stranger",
        email: `${prefix}stranger@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.superSa,
        name: "Super SA",
        email: `${prefix}super_sa@itest.local`,
        emailVerified: true,
        isSuperadmin: true,
      },
    ]);

    await db.insert(organizations).values([
      { id: ids.orgOn, name: "Org ADN On", active: true, adnSyncEnabled: true },
      { id: ids.orgOff, name: "Org ADN Off", active: true, adnSyncEnabled: false },
    ]);

    await db.insert(companies).values([
      {
        id: ids.companyOn,
        organizationId: ids.orgOn,
        cnpjDigits: "11222333000181",
        tradeName: "Empresa ADN On",
        systemCode: `sys-${prefix}on`,
        monthlyRunDay: 1,
        accountId: ids.adminOn,
      },
      {
        id: ids.companyOff,
        organizationId: ids.orgOff,
        cnpjDigits: "04252011000110",
        tradeName: "Empresa ADN Off",
        systemCode: `sys-${prefix}off`,
        monthlyRunDay: 1,
        accountId: ids.adminOff,
      },
    ]);

    await db.insert(organizationMemberships).values([
      { organizationId: ids.orgOn, userId: ids.adminOn, orgRole: "admin" },
      { organizationId: ids.orgOff, userId: ids.adminOff, orgRole: "admin" },
      { organizationId: ids.orgOn, userId: ids.orgUser, orgRole: "user" },
      { organizationId: ids.orgOff, userId: ids.stranger, orgRole: "admin" },
      { organizationId: ids.orgOn, userId: ids.superSa, orgRole: "user" },
    ]);

    await db.insert(companyMemberships).values([
      { companyId: ids.companyOn, userId: ids.adminOn, companyRole: "admin" },
      { companyId: ids.companyOn, userId: ids.orgUser, companyRole: "admin" },
      { companyId: ids.companyOn, userId: ids.superSa, companyRole: "admin" },
      { companyId: ids.companyOff, userId: ids.adminOff, companyRole: "admin" },
      { companyId: ids.companyOff, userId: ids.stranger, companyRole: "admin" },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    const userIds = [ids.adminOn, ids.adminOff, ids.orgUser, ids.stranger, ids.superSa];
    const companyIds = [ids.companyOn, ids.companyOff];
    const orgIds = [ids.orgOn, ids.orgOff];

    await db.delete(adnSyncJobs).where(inArray(adnSyncJobs.companyId, companyIds));
    await db.delete(auditEvents).where(
      or(
        inArray(auditEvents.actorUserId, userIds),
        inArray(auditEvents.companyId, companyIds),
        inArray(auditEvents.organizationId, orgIds),
      ),
    );
    await db.delete(companyMemberships).where(inArray(companyMemberships.companyId, companyIds));
    await db.delete(companies).where(inArray(companies.id, companyIds));
    await db.delete(organizationMemberships).where(inArray(organizationMemberships.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
    await db.delete(user).where(inArray(user.id, userIds));
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    clearAdnRateLimitBucketsForTests();
  });

  it("GET sync com ADN desactivado na organização → 404", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOff,
        email: "x@y",
        name: "Admin Off",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-off",
        userId: ids.adminOff,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOff,
        activeOrganizationId: ids.orgOff,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getAdnSync(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOff, companyId: ids.companyOff }),
    });
    expect(res.status).toBe(404);
  });

  it("GET sync sem membership na organização do URL → 403", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.stranger,
        email: "s@b",
        name: "Stranger",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-str",
        userId: ids.stranger,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOff,
        activeOrganizationId: ids.orgOff,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getAdnSync(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(res.status).toBe(403);
  });

  it("GET sync com organização activa na sessão diferente do URL → 403", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOn,
        email: "a@b",
        name: "Admin On",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-wrong",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: ids.orgOff,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getAdnSync(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(res.status).toBe(403);
  });

  it("GET sync com companyId de outra organização no path → 404", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOn,
        email: "a@b",
        name: "Admin On",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-mix",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getAdnSync(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOff }),
    });
    expect(res.status).toBe(404);
  });

  it("GET sync com ADN activo e permissões → 200", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOn,
        email: "a@b",
        name: "Admin On",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-ok",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getAdnSync(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lastJob: unknown };
    expect(body).toHaveProperty("lastJob");
  });

  it("POST sync como superadmin sem org_role admin → 403", async () => {
    clearAdnRateLimitBucketsForTests();
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.superSa,
        email: "sa@b",
        name: "Super SA",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: true,
      },
      session: {
        id: "s-sa",
        userId: ids.superSa,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await postAdnSync(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(res.status).toBe(403);
  });

  it("POST sync com papel de organização user → 403", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.orgUser,
        email: "u@b",
        name: "Org User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-user",
        userId: ids.orgUser,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await postAdnSync(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(res.status).toBe(403);
  });

  it("POST sync como admin de organização → 202 e registo de auditoria", async () => {
    clearAdnRateLimitBucketsForTests();
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOn,
        email: "a@b",
        name: "Admin On",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-post",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const idem = randomUUID();
    const res = await postAdnSync(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { job: { id: string; status: string } };
    expect(body.job.id).toMatch(/^[0-9a-f-]{36}$/i);

    const db = getDb();
    const [ev] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.actorUserId, ids.adminOn),
          eq(auditEvents.eventType, "adn_sync_requested"),
          eq(auditEvents.companyId, ids.companyOn),
        ),
      )
      .limit(1);
    expect(ev).toBeTruthy();

    await db.delete(adnSyncJobs).where(eq(adnSyncJobs.id, body.job.id));
    await db.delete(auditEvents).where(eq(auditEvents.id, ev!.id));
  });

  it("POST sync idempotente (mesma chave + mesmo corpo) → 202 com mesmo job", async () => {
    clearAdnRateLimitBucketsForTests();
    const prevRl = process.env.ADN_PUBLIC_SYNC_RATE_LIMIT_PER_MIN;
    process.env.ADN_PUBLIC_SYNC_RATE_LIMIT_PER_MIN = "60";
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOn,
        email: "a@b",
        name: "Admin On",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-idem",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const idem = randomUUID();
    const bodyStr = JSON.stringify({ issuedFrom: "2025-01-01", issuedTo: "2025-01-31" });
    const p1 = await postAdnSync(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
        body: bodyStr,
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(p1.status).toBe(202);
    const j1 = (await p1.json()) as { job: { id: string } };

    const p2 = await postAdnSync(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
        body: bodyStr,
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(p2.status).toBe(202);
    const j2 = (await p2.json()) as { job: { id: string } };
    expect(j2.job.id).toBe(j1.job.id);

    process.env.ADN_PUBLIC_SYNC_RATE_LIMIT_PER_MIN = prevRl;
    const db = getDb();
    await db.delete(adnSyncJobs).where(eq(adnSyncJobs.id, j1.job.id));
    await db.delete(auditEvents).where(
      and(eq(auditEvents.actorUserId, ids.adminOn), eq(auditEvents.eventType, "adn_sync_requested")),
    );
  });

  it("POST retry-bulk com 51 IDs → 400", async () => {
    clearAdnRateLimitBucketsForTests();
    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOn,
        email: "a@b",
        name: "Admin On",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-bulk",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const failureIds = Array.from({ length: 51 }, () => randomUUID());
    const res = await postRetryBulk(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failureIds }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error_code?: string };
    expect(j.error_code).toBe("ADN_INVALID_BULK_RETRY");
  });

  it("POST sync após limite por minuto → 429 com Retry-After", async () => {
    const prev = process.env.ADN_PUBLIC_SYNC_RATE_LIMIT_PER_MIN;
    process.env.ADN_PUBLIC_SYNC_RATE_LIMIT_PER_MIN = "1";
    clearAdnRateLimitBucketsForTests();

    vi.mocked(getAuthedSession).mockResolvedValue({
      user: {
        id: ids.adminOn,
        email: "a@b",
        name: "Admin On",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        isSuperadmin: false,
      },
      session: {
        id: "s-rl",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const first = await postAdnSync(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(first.status).toBe(202);
    const j0 = (await first.json()) as { job: { id: string } };

    const second = await postAdnSync(
      new Request("http://test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
    );
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
    const j429 = (await second.json()) as { error_code?: string };
    expect(j429.error_code).toBe("ADN_RATE_LIMIT");

    process.env.ADN_PUBLIC_SYNC_RATE_LIMIT_PER_MIN = prev;
    clearAdnRateLimitBucketsForTests();
    const db = getDb();
    await db.delete(adnSyncJobs).where(eq(adnSyncJobs.id, j0.job.id));
    await db.delete(auditEvents).where(
      and(eq(auditEvents.actorUserId, ids.adminOn), eq(auditEvents.eventType, "adn_sync_requested")),
    );
  });
});

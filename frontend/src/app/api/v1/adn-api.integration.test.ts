/**
 * Integração Postgres real (DATABASE_URL) — rotas públicas ADN (sync, retry-bulk).
 */
import { randomUUID } from "node:crypto";
import forge from "node-forge";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  adnIngestionFailures,
  adnSyncJobs,
  auditEvents,
  companies,
  companyCertificateAudits,
  companyCertificates,
  companyMemberships,
  organizationMemberships,
  organizations,
  user,
} from "@repo/db";
import { clearAdnRateLimitBucketsForTests } from "@/lib/adn-rate-limit";
import { clearAllReadinessMemoryForTests } from "@/lib/adn-certificate-readiness-memory";
import { getDb } from "@/lib/db";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { GET as getAdnFailures } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/failures/route";
import { GET as getAdnSync, POST as postAdnSync } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/sync/route";
import { GET as getCertReadiness } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/certificate-readiness/route";
import { POST as postCertReadinessVerify } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/certificate-readiness/verify/route";
import { POST as postRetryBulk } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/failures/retry-bulk/route";
import {
  DELETE as deleteCompanyCertificate,
  GET as getCompanyCertificate,
  POST as postCompanyCertificate,
} from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/certificate/route";
import { GET as getAutomationExportJson } from "@/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/automation-export.json/route";
import { GET as getAdnRecentJobs } from "@/app/api/v1/organizations/[organizationId]/adn/recent-jobs/route";
import { clearCertUploadVaultMockForTests } from "@/server/cert-upload/cert-upload-vault";

const hasDb = Boolean(process.env.DATABASE_URL);

function buildIntegrationPkcs12(cnpj14: string, password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(512);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
  const attrs: forge.pki.CertificateField[] = [
    { name: "commonName", value: `Empresa IT ${cnpj14}` },
    { name: "countryName", value: "BR" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "aes256",
    count: 2048,
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
}

function pkcs12File(buf: Buffer, filename: string): File {
  const u8 = Uint8Array.from(buf);
  return new File([new Blob([u8])], filename, { type: "application/x-pkcs12" });
}

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

    await db.delete(adnIngestionFailures).where(inArray(adnIngestionFailures.companyId, companyIds));
    await db.delete(companyCertificateAudits).where(inArray(companyCertificateAudits.companyId, companyIds));
    await db.delete(companyCertificates).where(inArray(companyCertificates.companyId, companyIds));
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
    clearAllReadinessMemoryForTests();
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

  it("GET failures com ADN_WORKER_CERT_NOT_FOUND mapeia mensagem CE-FR10 sem vazar paths (CER-05 AC5)", async () => {
    const db = getDb();
    const failureId = randomUUID();
    await db.insert(adnIngestionFailures).values({
      id: failureId,
      organizationId: ids.orgOn,
      companyId: ids.companyOn,
      errorCode: "ADN_WORKER_CERT_NOT_FOUND",
      errorDetail:
        "certificates/11222333000181.pfx missing; thumbprint=ABCDEF1234567890ABCDEF1234567890ABCDEF12",
      kind: "xml",
    });

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
        id: "s-fail",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getAdnFailures(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toMatch(/certificates\//i);
    expect(raw).not.toMatch(/\.pfx/i);
    expect(raw).not.toMatch(/thumbprint=/i);
    const body = JSON.parse(raw) as {
      items: Array<{ errorCode: string; userMessage: string; message: string }>;
    };
    const row = body.items.find((i) => i.errorCode === "ADN_WORKER_CERT_NOT_FOUND");
    const expected =
      "Não foi possível validar o certificado da empresa no servidor de recolha.";
    expect(row?.userMessage).toBe(expected);
    expect(row?.message).toBe(expected);

    await db.delete(adnIngestionFailures).where(eq(adnIngestionFailures.id, failureId));
  });

  it("GET certificate-readiness com ADN desactivado na organização e API de upload desactivada → 404", async () => {
    const prevCertApi = process.env.CERT_UPLOAD_API_ENABLED;
    delete process.env.CERT_UPLOAD_API_ENABLED;
    try {
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
          id: "s-cr-off",
          userId: ids.adminOff,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOff,
          activeOrganizationId: ids.orgOff,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const res = await getCertReadiness(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOff, companyId: ids.companyOff }),
      });
      expect(res.status).toBe(404);
    } finally {
      if (prevCertApi === undefined) {
        delete process.env.CERT_UPLOAD_API_ENABLED;
      } else {
        process.env.CERT_UPLOAD_API_ENABLED = prevCertApi;
      }
    }
  });

  it("GET certificate-readiness com ADN desactivado na organização e API de upload activa → 200", async () => {
    clearAllReadinessMemoryForTests();
    const prevCertApi = process.env.CERT_UPLOAD_API_ENABLED;
    process.env.CERT_UPLOAD_API_ENABLED = "true";
    try {
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
          id: "s-cr-off-upload",
          userId: ids.adminOff,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOff,
          activeOrganizationId: ids.orgOff,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const res = await getCertReadiness(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOff, companyId: ids.companyOff }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const body = (await res.json()) as {
        certificateReadiness: string;
        canVerify: boolean;
      };
      expect(body.certificateReadiness).toBe("pendente_verificacao");
      expect(body.canVerify).toBe(true);
    } finally {
      if (prevCertApi === undefined) {
        delete process.env.CERT_UPLOAD_API_ENABLED;
      } else {
        process.env.CERT_UPLOAD_API_ENABLED = prevCertApi;
      }
    }
  });

  it("GET certificate-readiness sem sessão → 401", async () => {
    vi.mocked(getAuthedSession).mockResolvedValue(null);
    const res = await getCertReadiness(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(res.status).toBe(401);
  });

  it("GET certificate-readiness com companyId de outra organização no path → 404 (UIP-01 AC7)", async () => {
    clearAllReadinessMemoryForTests();
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
        id: "s-cr",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getCertReadiness(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOff }),
    });
    expect(res.status).toBe(404);
    const raw = await res.text();
    expect(raw).not.toContain("certificateReadiness");
  });

  it("GET certificate-readiness com ADN activo → 200, Cache-Control no-store, nível 0", async () => {
    clearAllReadinessMemoryForTests();
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
        id: "s-cr2",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await getCertReadiness(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as {
      certificateReadiness: string;
      lastCheckedAt: string | null;
      probeAvailable: boolean;
      canVerify: boolean;
    };
    expect(body.certificateReadiness).toBe("pendente_verificacao");
    expect(body.lastCheckedAt).toBeNull();
    expect(body.probeAvailable).toBe(false);
    expect(body.canVerify).toBe(true);
  });

  it("POST certificate-readiness/verify como user org → 403", async () => {
    clearAdnRateLimitBucketsForTests();
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
        id: "s-crv",
        userId: ids.orgUser,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const res = await postCertReadinessVerify(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(res.status).toBe(403);
  });

  it("POST verify nível 0: dois POSTs avançam lastCheckedAt; GET reflecte (UIP-02 AC4)", async () => {
    clearAllReadinessMemoryForTests();
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
        id: "s-pv0",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const p1 = await postCertReadinessVerify(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(p1.status).toBe(200);
    const j1 = (await p1.json()) as { lastCheckedAt: string; certificateReadiness: string };
    expect(j1.certificateReadiness).toBe("pendente_verificacao");
    expect(j1.lastCheckedAt).toBeTruthy();

    await new Promise((r) => setTimeout(r, 5));

    const p2 = await postCertReadinessVerify(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(p2.status).toBe(200);
    const j2 = (await p2.json()) as { lastCheckedAt: string };
    expect(Date.parse(j2.lastCheckedAt)).toBeGreaterThanOrEqual(Date.parse(j1.lastCheckedAt));

    const g = await getCertReadiness(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(g.status).toBe(200);
    const jg = (await g.json()) as { lastCheckedAt: string | null; certificateReadiness: string };
    expect(jg.lastCheckedAt).toBe(j2.lastCheckedAt);
    expect(jg.certificateReadiness).toBe("pendente_verificacao");
  });

  it("POST verify após limite → 429 com Retry-After e retryAfterSeconds", async () => {
    const prev = process.env.ADN_CERT_VERIFY_RATE_LIMIT_PER_MIN;
    process.env.ADN_CERT_VERIFY_RATE_LIMIT_PER_MIN = "1";
    clearAllReadinessMemoryForTests();
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
        id: "s-pvrl",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    const first = await postCertReadinessVerify(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(first.status).toBe(200);

    const second = await postCertReadinessVerify(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
    });
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
    const j429 = (await second.json()) as { error_code?: string; retryAfterSeconds?: number };
    expect(j429.error_code).toBe("ADN_RATE_LIMIT");
    expect(typeof j429.retryAfterSeconds).toBe("number");

    process.env.ADN_CERT_VERIFY_RATE_LIMIT_PER_MIN = prev;
    clearAdnRateLimitBucketsForTests();
  });

  it("UIP-03: resposta pública do verify não contém substrings sensíveis do JSON interno do worker", async () => {
    clearAllReadinessMemoryForTests();
    clearAdnRateLimitBucketsForTests();
    const prevBase = process.env.ADN_WORKER_INTERNAL_BASE_URL;
    const prevSecret = process.env.ADN_WORKER_HMAC_SECRET;
    const prevProbe = process.env.ADN_CERT_PROBE_ENABLED;
    process.env.ADN_WORKER_INTERNAL_BASE_URL = "http://adn-worker-probe.test";
    process.env.ADN_WORKER_HMAC_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.ADN_CERT_PROBE_ENABLED = "true";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("http://adn-worker-probe.test")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error_code: "ADN_WORKER_CERT_NOT_FOUND",
            leak: "certificates/11222333000181.pfx thumbprint=ABCDEF",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

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
        id: "s-prb",
        userId: ids.adminOn,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: ids.companyOn,
        activeOrganizationId: ids.orgOn,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);

    try {
      const res = await postCertReadinessVerify(new Request("http://test/", { method: "POST" }), {
        params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
      });
      expect(res.status).toBe(200);
      const raw = await res.text();
      expect(raw).not.toMatch(/certificates\//i);
      expect(raw).not.toMatch(/\.pfx/i);
      expect(raw).not.toMatch(/thumbprint=/i);
    } finally {
      vi.unstubAllGlobals();
      process.env.ADN_WORKER_INTERNAL_BASE_URL = prevBase;
      process.env.ADN_WORKER_HMAC_SECRET = prevSecret;
      process.env.ADN_CERT_PROBE_ENABLED = prevProbe;
      clearAllReadinessMemoryForTests();
      clearAdnRateLimitBucketsForTests();
    }
  });

  describe("GET …/certificate (upload ADN)", () => {
    afterEach(() => {
      clearCertUploadVaultMockForTests();
    });

    it("sem CERT_UPLOAD_API_ENABLED → 404", async () => {
      const prev = process.env.CERT_UPLOAD_API_ENABLED;
      delete process.env.CERT_UPLOAD_API_ENABLED;
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
          id: "s-cert-off",
          userId: ids.adminOn,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOn,
          activeOrganizationId: ids.orgOn,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const res = await getCompanyCertificate(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
      });
      expect(res.status).toBe(404);
      if (prev === undefined) {
        delete process.env.CERT_UPLOAD_API_ENABLED;
      } else {
        process.env.CERT_UPLOAD_API_ENABLED = prev;
      }
    });

    it("com CERT_UPLOAD_API_ENABLED=true admin org GET → 200, canUpload true", async () => {
      const prev = process.env.CERT_UPLOAD_API_ENABLED;
      process.env.CERT_UPLOAD_API_ENABLED = "true";
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
          id: "s-cert-on",
          userId: ids.adminOn,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOn,
          activeOrganizationId: ids.orgOn,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      try {
        const res = await getCompanyCertificate(new Request("http://test/"), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
        expect(res.status).toBe(200);
        const j = (await res.json()) as {
          capabilities: { canUpload: boolean };
          status: string | null;
        };
        expect(j.capabilities.canUpload).toBe(true);
        expect(j.status).toBeNull();
      } finally {
        if (prev === undefined) {
          delete process.env.CERT_UPLOAD_API_ENABLED;
        } else {
          process.env.CERT_UPLOAD_API_ENABLED = prev;
        }
      }
    });

    it("RLS: existem políticas em company_certificates (catálogo)", async () => {
      const db = getDb();
      const rows = await db.execute(sql`
        select policyname from pg_policies
        where schemaname = 'public' and tablename = 'company_certificates'
      `);
      const list = Array.from(rows as Iterable<{ policyname: string }>);
      expect(list.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST/DELETE …/certificate (UBR-05 AC3)", () => {
    const adminSession = (): Awaited<ReturnType<typeof getAuthedSession>> =>
      ({
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
          id: "s-cert-post",
          userId: ids.adminOn,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOn,
          activeOrganizationId: ids.orgOn,
        },
      }) as Awaited<ReturnType<typeof getAuthedSession>>;

    afterEach(() => {
      clearCertUploadVaultMockForTests();
      clearAdnRateLimitBucketsForTests();
    });

    it("POST Content-Type não multipart → 415 CERT_UPLOAD_EXPECT_MULTIPART", async () => {
      const prev = process.env.CERT_UPLOAD_API_ENABLED;
      process.env.CERT_UPLOAD_API_ENABLED = "true";
      vi.mocked(getAuthedSession).mockResolvedValue(adminSession());
      try {
        const res = await postCompanyCertificate(
          new Request("http://test/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }),
          { params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }) },
        );
        expect(res.status).toBe(415);
        const j = (await res.json()) as { error_code?: string };
        expect(j.error_code).toBe("CERT_UPLOAD_EXPECT_MULTIPART");
      } finally {
        if (prev === undefined) delete process.env.CERT_UPLOAD_API_ENABLED;
        else process.env.CERT_UPLOAD_API_ENABLED = prev;
      }
    });

    it("POST senha incorrecta → 400 CERT_UPLOAD_BAD_PASSWORD", async () => {
      const prev = process.env.CERT_UPLOAD_API_ENABLED;
      process.env.CERT_UPLOAD_API_ENABLED = "true";
      vi.mocked(getAuthedSession).mockResolvedValue(adminSession());
      const buf = buildIntegrationPkcs12("11222333000181", "secret");
      const fd = new FormData();
      fd.set("file", pkcs12File(buf, "cert.pfx"));
      fd.set("password", "wrong-password");
      try {
        const res = await postCompanyCertificate(new Request("http://test/", { method: "POST", body: fd }), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
        expect(res.status).toBe(400);
        const j = (await res.json()) as { error_code?: string };
        expect(j.error_code).toBe("CERT_UPLOAD_BAD_PASSWORD");
      } finally {
        if (prev === undefined) delete process.env.CERT_UPLOAD_API_ENABLED;
        else process.env.CERT_UPLOAD_API_ENABLED = prev;
      }
    });

    it("POST CNPJ do certificado ≠ empresa → 400 CERT_UPLOAD_CNPJ_MISMATCH", async () => {
      const prev = process.env.CERT_UPLOAD_API_ENABLED;
      process.env.CERT_UPLOAD_API_ENABLED = "true";
      vi.mocked(getAuthedSession).mockResolvedValue(adminSession());
      const buf = buildIntegrationPkcs12("04252011000110", "pw");
      const fd = new FormData();
      fd.set("file", pkcs12File(buf, "cert.pfx"));
      fd.set("password", "pw");
      try {
        const res = await postCompanyCertificate(new Request("http://test/", { method: "POST", body: fd }), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
        expect(res.status).toBe(400);
        const j = (await res.json()) as { error_code?: string };
        expect(j.error_code).toBe("CERT_UPLOAD_CNPJ_MISMATCH");
      } finally {
        if (prev === undefined) delete process.env.CERT_UPLOAD_API_ENABLED;
        else process.env.CERT_UPLOAD_API_ENABLED = prev;
      }
    });

    it("POST ficheiro demasiado grande → 413", async () => {
      const prevApi = process.env.CERT_UPLOAD_API_ENABLED;
      const prevMax = process.env.CERT_UPLOAD_MAX_BYTES;
      process.env.CERT_UPLOAD_API_ENABLED = "true";
      process.env.CERT_UPLOAD_MAX_BYTES = "50";
      vi.mocked(getAuthedSession).mockResolvedValue(adminSession());
      const buf = buildIntegrationPkcs12("11222333000181", "pw");
      const fd = new FormData();
      fd.set("file", pkcs12File(buf, "cert.pfx"));
      fd.set("password", "pw");
      try {
        const res = await postCompanyCertificate(new Request("http://test/", { method: "POST", body: fd }), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
        expect(res.status).toBe(413);
        const j = (await res.json()) as { error_code?: string };
        expect(j.error_code).toBe("CERT_UPLOAD_FILE_TOO_LARGE");
      } finally {
        if (prevApi === undefined) delete process.env.CERT_UPLOAD_API_ENABLED;
        else process.env.CERT_UPLOAD_API_ENABLED = prevApi;
        if (prevMax === undefined) delete process.env.CERT_UPLOAD_MAX_BYTES;
        else process.env.CERT_UPLOAD_MAX_BYTES = prevMax;
      }
    });

    it("POST excede rate limit → 429", async () => {
      const prevApi = process.env.CERT_UPLOAD_API_ENABLED;
      const prevMax = process.env.CERT_UPLOAD_MAX_BYTES;
      const prevRl = process.env.CERT_UPLOAD_RATE_MAX_PER_WINDOW;
      process.env.CERT_UPLOAD_API_ENABLED = "true";
      delete process.env.CERT_UPLOAD_MAX_BYTES;
      process.env.CERT_UPLOAD_RATE_MAX_PER_WINDOW = "2";
      vi.mocked(getAuthedSession).mockResolvedValue(adminSession());
      const buf = buildIntegrationPkcs12("11222333000181", "pw1");
      const postOnce = async () => {
        const fd = new FormData();
        fd.set("file", pkcs12File(buf, "cert.pfx"));
        fd.set("password", "pw1");
        return postCompanyCertificate(new Request("http://test/", { method: "POST", body: fd }), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
      };
      try {
        expect((await postOnce()).status).toBe(204);
        expect((await postOnce()).status).toBe(204);
        const third = await postOnce();
        expect(third.status).toBe(429);
        const j = (await third.json()) as { error_code?: string };
        expect(j.error_code).toBe("CERT_UPLOAD_RATE_LIMITED");
      } finally {
        if (prevApi === undefined) delete process.env.CERT_UPLOAD_API_ENABLED;
        else process.env.CERT_UPLOAD_API_ENABLED = prevApi;
        if (prevMax === undefined) delete process.env.CERT_UPLOAD_MAX_BYTES;
        else process.env.CERT_UPLOAD_MAX_BYTES = prevMax;
        if (prevRl === undefined) delete process.env.CERT_UPLOAD_RATE_MAX_PER_WINDOW;
        else process.env.CERT_UPLOAD_RATE_MAX_PER_WINDOW = prevRl;
      }
    });

    it("POST válido → 204; DELETE idempotente → 204", async () => {
      const prev = process.env.CERT_UPLOAD_API_ENABLED;
      process.env.CERT_UPLOAD_API_ENABLED = "true";
      vi.mocked(getAuthedSession).mockResolvedValue(adminSession());
      const buf = buildIntegrationPkcs12("11222333000181", "goodpw");
      const fd = new FormData();
      fd.set("file", pkcs12File(buf, "cert.pfx"));
      fd.set("password", "goodpw");
      try {
        const res = await postCompanyCertificate(new Request("http://test/", { method: "POST", body: fd }), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
        expect(res.status).toBe(204);
        const d1 = await deleteCompanyCertificate(new Request("http://test/", { method: "DELETE" }), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
        expect(d1.status).toBe(204);
        const d2 = await deleteCompanyCertificate(new Request("http://test/", { method: "DELETE" }), {
          params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
        });
        expect(d2.status).toBe(204);
      } finally {
        if (prev === undefined) delete process.env.CERT_UPLOAD_API_ENABLED;
        else process.env.CERT_UPLOAD_API_ENABLED = prev;
      }
    });
  });

  describe("GET /organizations/:id/adn/recent-jobs", () => {
    it("organização com ADN desactivado → 404", async () => {
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
          id: "s-rj-off",
          userId: ids.adminOff,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOff,
          activeOrganizationId: ids.orgOff,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const res = await getAdnRecentJobs(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOff }),
      });
      expect(res.status).toBe(404);
    });

    it("sem membership na org do URL → 403", async () => {
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
          id: "s-rj-str",
          userId: ids.stranger,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOff,
          activeOrganizationId: ids.orgOff,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const res = await getAdnRecentJobs(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOn }),
      });
      expect(res.status).toBe(403);
    });

    it("lista jobs com summary e paginação por limit", async () => {
      const db = getDb();
      const j1 = randomUUID();
      const j2 = randomUUID();
      const j3 = randomUUID();
      await db.insert(adnSyncJobs).values([
        {
          id: j1,
          organizationId: ids.orgOn,
          companyId: ids.companyOn,
          status: "completed",
          trigger: "manual",
          summaryJson: { downloadEngine: "nfse_dist", phase: "completed" },
          createdAt: new Date("2026-02-01T10:00:00.000Z"),
        },
        {
          id: j2,
          organizationId: ids.orgOn,
          companyId: ids.companyOn,
          status: "failed",
          trigger: "manual",
          summaryJson: { failureCategory: "session", phase: "error" },
          createdAt: new Date("2026-02-02T10:00:00.000Z"),
        },
        {
          id: j3,
          organizationId: ids.orgOn,
          companyId: ids.companyOn,
          status: "queued",
          trigger: "manual",
          createdAt: new Date("2026-02-03T10:00:00.000Z"),
        },
      ]);

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
          id: "s-rj-ok",
          userId: ids.adminOn,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOn,
          activeOrganizationId: ids.orgOn,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const res = await getAdnRecentJobs(
        new Request("http://test/?limit=2"),
        { params: Promise.resolve({ organizationId: ids.orgOn }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        jobs: Array<{ id: string; summary: Record<string, unknown> | null }>;
        nextCursor: string | null;
      };
      expect(body.jobs.length).toBe(2);
      expect(body.jobs[0]?.id).toBe(j3);
      expect(body.jobs[1]?.id).toBe(j2);
      expect(body.nextCursor).toBeTruthy();
      expect(body.jobs[0]?.summary?.downloadEngine ?? body.jobs[1]?.summary?.failureCategory).toBeTruthy();

      await db.delete(adnSyncJobs).where(
        inArray(adnSyncJobs.id, [j1, j2, j3]),
      );
    });

    it("second request exceeds GET rate limit → 429", async () => {
      const prev = process.env.ADN_PUBLIC_RECENT_JOBS_RATE_LIMIT_PER_MIN;
      process.env.ADN_PUBLIC_RECENT_JOBS_RATE_LIMIT_PER_MIN = "1";
      clearAdnRateLimitBucketsForTests();

      vi.mocked(getAuthedSession).mockResolvedValue({
        user: {
          id: ids.orgUser,
          email: "ou@b",
          name: "Org User",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
          isSuperadmin: false,
        },
        session: {
          id: "s-rj-rl",
          userId: ids.orgUser,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOn,
          activeOrganizationId: ids.orgOn,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const first = await getAdnRecentJobs(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOn }),
      });
      expect(first.status).toBe(200);

      const second = await getAdnRecentJobs(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOn }),
      });
      expect(second.status).toBe(429);
      expect(second.headers.get("Retry-After")).toBeTruthy();
      const j429 = (await second.json()) as { error_code?: string };
      expect(j429.error_code).toBe("ADN_RATE_LIMIT");

      process.env.ADN_PUBLIC_RECENT_JOBS_RATE_LIMIT_PER_MIN = prev;
      clearAdnRateLimitBucketsForTests();
    });
  });

  describe("FR48 — export automation JSON", () => {
    it("não inclui chaves de segredo de certificado", async () => {
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
          id: "s-fr48",
          userId: ids.adminOn,
          expiresAt: new Date(),
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          activeCompanyId: ids.companyOn,
          activeOrganizationId: ids.orgOn,
        },
      } as Awaited<ReturnType<typeof getAuthedSession>>);

      const res = await getAutomationExportJson(new Request("http://test/"), {
        params: Promise.resolve({ organizationId: ids.orgOn, companyId: ids.companyOn }),
      });
      expect(res.status).toBe(200);
      const text = (await res.text()).toLowerCase();
      for (const bad of ["vault_ref", "thumbprint", "pkcs12", "pfx\"", "private_key", "certificate_password"]) {
        expect(text).not.toContain(bad);
      }
      const data = JSON.parse(text) as { monitoredCompanies?: Array<Record<string, unknown>> };
      const keySet = new Set<string>();
      const walk = (o: unknown) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) {
          for (const x of o) walk(x);
          return;
        }
        for (const k of Object.keys(o as object)) {
          keySet.add(k.toLowerCase());
          walk((o as Record<string, unknown>)[k]);
        }
      };
      walk(data.monitoredCompanies);
      expect([...keySet].some((k) => k.includes("vault") || k.includes("thumbprint"))).toBe(false);
    });
  });
});

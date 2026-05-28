/**
 * Integração — rotas internas ADN (prepare / commit) com HMAC.
 */
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { adnArtifactDrafts, companies, organizations } from "@repo/db";
import { clearAdnRateLimitBucketsForTests } from "@/lib/adn-rate-limit";
import { getDb } from "@/lib/db";
import { POST as postCommit } from "@/app/api/internal/v1/adn/artifacts/commit/route";
import { POST as postPrepare } from "@/app/api/internal/v1/adn/uploads/prepare/route";

const hasDb = Boolean(process.env.DATABASE_URL);

function signAdnBody(body: string, secret: string): { ts: string; sig: string } {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", secret).update(Buffer.from(body, "utf8")).digest("hex");
  return { ts, sig };
}

function adnRequest(url: string, body: object, secret: string): Request {
  const raw = JSON.stringify(body);
  const { ts, sig } = signAdnBody(raw, secret);
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ADN-Timestamp": ts,
      "X-ADN-Signature": sig,
    },
    body: raw,
  });
}

describe.skipIf(!hasDb)("API interna ADN (integração)", () => {
  const prefix = `adn_int_${Date.now()}_`;
  const secret = "0123456789abcdef0123456789abcdef";
  const ids = {
    orgOn: randomUUID(),
    orgOff: randomUUID(),
    companyOn: randomUUID(),
    companyOff: randomUUID(),
  };

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    process.env.ADN_WORKER_HMAC_SECRET = secret;
    process.env.ADN_COMMIT_VERIFY_STORAGE_SHA256 = "false";
    clearAdnRateLimitBucketsForTests();

    const db = getDb();
    await db.insert(organizations).values([
      { id: ids.orgOn, name: "Org On", active: true, adnSyncEnabled: true },
      { id: ids.orgOff, name: "Org Off", active: true, adnSyncEnabled: false },
    ]);
    await db.insert(companies).values([
      {
        id: ids.companyOn,
        organizationId: ids.orgOn,
        cnpjDigits: "11222333000181",
        tradeName: "Co On",
        systemCode: `sys-${prefix}on`,
        monthlyRunDay: 1,
        accountId: null,
      },
      {
        id: ids.companyOff,
        organizationId: ids.orgOff,
        cnpjDigits: "04252011000110",
        tradeName: "Co Off",
        systemCode: `sys-${prefix}off`,
        monthlyRunDay: 1,
        accountId: null,
      },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(adnArtifactDrafts).where(eq(adnArtifactDrafts.organizationId, ids.orgOff));
    await db.delete(adnArtifactDrafts).where(eq(adnArtifactDrafts.organizationId, ids.orgOn));
    await db.delete(companies).where(eq(companies.id, ids.companyOn));
    await db.delete(companies).where(eq(companies.id, ids.companyOff));
    await db.delete(organizations).where(eq(organizations.id, ids.orgOn));
    await db.delete(organizations).where(eq(organizations.id, ids.orgOff));
  });

  it("prepare com org ADN desactivada → 403", async () => {
    const body = {
      organizationId: ids.orgOff,
      companyId: ids.companyOff,
      accessKey: "0".repeat(44),
      sha256: "a".repeat(64),
      contentType: "application/xml",
      kind: "xml",
    };
    const res = await postPrepare(adnRequest("http://test/internal/prepare", body, secret));
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error_code?: string };
    expect(j.error_code).toBe("ADN_SYNC_DISABLED");
  });

  it("commit com draft de org ADN desactivada → 403", async () => {
    const db = getDb();
    const draftId = randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(adnArtifactDrafts).values({
      id: draftId,
      organizationId: ids.orgOff,
      companyId: ids.companyOff,
      accessKey: "1".repeat(44),
      kind: "xml",
      contentSha256: "b".repeat(64),
      storageBucket: "adn-artifacts",
      storageObjectKey: `org/${ids.orgOff}/test.xml`,
      expiresAt: expires,
    });

    const body = {
      artifactDraftId: draftId,
      issuedAt: new Date().toISOString(),
    };
    const res = await postCommit(adnRequest("http://test/internal/commit", body, secret));
    expect(res.status).toBe(403);
  });

  it("commit com draft expirado → 400 ADN_DRAFT_EXPIRED", async () => {
    const db = getDb();
    const draftId = randomUUID();
    await db.insert(adnArtifactDrafts).values({
      id: draftId,
      organizationId: ids.orgOn,
      companyId: ids.companyOn,
      accessKey: "2".repeat(44),
      kind: "xml",
      contentSha256: "c".repeat(64),
      storageBucket: "adn-artifacts",
      storageObjectKey: `org/${ids.orgOn}/expired.xml`,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const body = {
      artifactDraftId: draftId,
      issuedAt: new Date().toISOString(),
    };
    const res = await postCommit(adnRequest("http://test/internal/commit", body, secret));
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error_code?: string };
    expect(j.error_code).toBe("ADN_DRAFT_EXPIRED");
  });
});

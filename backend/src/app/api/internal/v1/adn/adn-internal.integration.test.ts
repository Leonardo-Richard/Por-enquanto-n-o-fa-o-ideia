/**
 * Paridade com frontend — rotas internas ADN (prepare / commit).
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

describe.skipIf(!hasDb)("API interna ADN backend (integração)", () => {
  const prefix = `adn_be_${Date.now()}_`;
  const secret = "0123456789abcdef0123456789abcdef";
  const ids = {
    orgOff: randomUUID(),
    companyOff: randomUUID(),
  };

  beforeAll(async () => {
    process.env.ADN_WORKER_HMAC_SECRET = secret;
    process.env.ADN_COMMIT_VERIFY_STORAGE_SHA256 = "false";
    clearAdnRateLimitBucketsForTests();
    const db = getDb();
    await db.insert(organizations).values([
      { id: ids.orgOff, name: "Org Off BE", active: true, adnSyncEnabled: false },
    ]);
    await db.insert(companies).values([
      {
        id: ids.companyOff,
        organizationId: ids.orgOff,
        cnpjDigits: "04252011000110",
        tradeName: "Co Off BE",
        systemCode: `sys-${prefix}off`,
        monthlyRunDay: 1,
        accountId: null,
      },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(adnArtifactDrafts).where(eq(adnArtifactDrafts.organizationId, ids.orgOff));
    await db.delete(companies).where(eq(companies.id, ids.companyOff));
    await db.delete(organizations).where(eq(organizations.id, ids.orgOff));
  });

  it("commit com org ADN desactivada → 403", async () => {
    const db = getDb();
    const draftId = randomUUID();
    await db.insert(adnArtifactDrafts).values({
      id: draftId,
      organizationId: ids.orgOff,
      companyId: ids.companyOff,
      accessKey: "3".repeat(44),
      kind: "xml",
      contentSha256: "d".repeat(64),
      storageBucket: "adn-artifacts",
      storageObjectKey: `org/${ids.orgOff}/test.xml`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await postCommit(
      adnRequest(
        "http://test/internal/commit",
        { artifactDraftId: draftId, issuedAt: new Date().toISOString() },
        secret,
      ),
    );
    expect(res.status).toBe(403);
  });

  it("prepare com org ADN desactivada → 403", async () => {
    const res = await postPrepare(
      adnRequest(
        "http://test/internal/prepare",
        {
          organizationId: ids.orgOff,
          companyId: ids.companyOff,
          accessKey: "4".repeat(44),
          sha256: "e".repeat(64),
          contentType: "application/xml",
        },
        secret,
      ),
    );
    expect(res.status).toBe(403);
  });
});

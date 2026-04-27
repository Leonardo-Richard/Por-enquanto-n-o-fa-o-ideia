/**
 * Integração Postgres real (DATABASE_URL) — GET/PATCH adn-sync-settings + localDownloadRoot (LM-01B).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, or } from "drizzle-orm";
import { auditEvents, organizationMemberships, organizations, session, user } from "@repo/db";
import { getDb } from "@/lib/db";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { GET as getAdnSettings, PATCH as patchAdnSettings } from "@/app/api/v1/organizations/[organizationId]/adn-sync-settings/route";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("API adn-sync-settings + localDownloadRoot (integração)", () => {
  const prefix = `lm_adn_${Date.now()}_`;
  const ids = {
    adminA: `u_${prefix}admin_a`,
    memberA: `u_${prefix}member_a`,
    superCarol: `u_${prefix}super`,
    orgA: randomUUID(),
    orgB: randomUUID(),
    sessionAdmin: `sess_${prefix}adm`,
    sessionMember: `sess_${prefix}mem`,
    sessionSuper: `sess_${prefix}sup`,
  };

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    const db = getDb();

    await db.insert(user).values([
      {
        id: ids.adminA,
        name: "Admin A",
        email: `${prefix}admin_a@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.memberA,
        name: "Member A",
        email: `${prefix}member_a@itest.local`,
        emailVerified: true,
        isSuperadmin: false,
      },
      {
        id: ids.superCarol,
        name: "Super",
        email: `${prefix}super@itest.local`,
        emailVerified: true,
        isSuperadmin: true,
      },
    ]);

    await db.insert(organizations).values([
      { id: ids.orgA, name: "Org LM A", active: true, adnSyncEnabled: false },
      { id: ids.orgB, name: "Org LM B", active: true, adnSyncEnabled: false },
    ]);

    await db.insert(organizationMemberships).values([
      { organizationId: ids.orgA, userId: ids.adminA, orgRole: "admin" },
      { organizationId: ids.orgA, userId: ids.memberA, orgRole: "user" },
    ]);

    await db.insert(session).values([
      {
        id: ids.sessionAdmin,
        expiresAt: new Date(Date.now() + 86_400_000),
        token: `${prefix}tok_adm`,
        userId: ids.adminA,
        activeCompanyId: null,
        activeOrganizationId: ids.orgA,
      },
      {
        id: ids.sessionMember,
        expiresAt: new Date(Date.now() + 86_400_000),
        token: `${prefix}tok_mem`,
        userId: ids.memberA,
        activeCompanyId: null,
        activeOrganizationId: ids.orgA,
      },
      {
        id: ids.sessionSuper,
        expiresAt: new Date(Date.now() + 86_400_000),
        token: `${prefix}tok_sup`,
        userId: ids.superCarol,
        activeCompanyId: null,
        activeOrganizationId: ids.orgA,
      },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(session).where(
      inArray(session.id, [ids.sessionAdmin, ids.sessionMember, ids.sessionSuper]),
    );
    const userIds = [ids.adminA, ids.memberA, ids.superCarol];
    await db.delete(auditEvents).where(
      or(inArray(auditEvents.actorUserId, userIds), inArray(auditEvents.organizationId, [ids.orgA, ids.orgB])),
    );
    await db.delete(organizationMemberships).where(
      inArray(organizationMemberships.organizationId, [ids.orgA, ids.orgB]),
    );
    await db.delete(organizations).where(inArray(organizations.id, [ids.orgA, ids.orgB]));
    await db.delete(user).where(inArray(user.id, userIds));
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
  });

  function mockSession(userId: string, activeOrg: string | null) {
    const u =
      userId === ids.adminA
        ? {
            id: ids.adminA,
            email: "a@x",
            name: "Admin A",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            image: null,
            isSuperadmin: false,
          }
        : userId === ids.memberA
          ? {
              id: ids.memberA,
              email: "m@x",
              name: "Member A",
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              image: null,
              isSuperadmin: false,
            }
          : {
              id: ids.superCarol,
              email: "s@x",
              name: "Super",
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              image: null,
              isSuperadmin: true,
            };

    vi.mocked(getAuthedSession).mockResolvedValue({
      user: u,
      session: {
        id: "s1",
        userId,
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
        activeCompanyId: null,
        activeOrganizationId: activeOrg,
      },
    } as Awaited<ReturnType<typeof getAuthedSession>>);
  }

  it("membro user: GET inclui localDownloadRoot; PATCH path → 403 (D1 / AC5)", async () => {
    mockSession(ids.memberA, ids.orgA);
    const getRes = await getAdnSettings(new Request("http://test/"), {
      params: Promise.resolve({ organizationId: ids.orgA }),
    });
    expect(getRes.status).toBe(200);
    const gj = (await getRes.json()) as { localDownloadRoot: string | null; canManage: boolean };
    expect("localDownloadRoot" in gj).toBe(true);
    expect(gj.canManage).toBe(false);

    const patchRes = await patchAdnSettings(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localDownloadRoot: "C:\\X" }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgA }) },
    );
    expect(patchRes.status).toBe(403);
  });

  it("admin: PATCH round-trip localDownloadRoot + auditoria ao mudar", async () => {
    mockSession(ids.adminA, ids.orgA);
    await patchAdnSettings(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localDownloadRoot: null }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgA }) },
    );
    const path1 = `C:\\LM-IT-${randomUUID().slice(0, 8)}`;
    const r1 = await patchAdnSettings(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localDownloadRoot: path1 }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgA }) },
    );
    expect(r1.status).toBe(200);
    const j1 = (await r1.json()) as { localDownloadRoot: string | null };
    expect(j1.localDownloadRoot).toBe(path1);

    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, ids.orgA),
          eq(auditEvents.eventType, "organization_local_download_root_updated"),
        ),
      );
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const meta = audits[audits.length - 1]!.metadata as Record<string, unknown>;
    expect(meta.previousLength).toBeTypeOf("number");
    expect(meta.newLength).toBe(path1.length);
    expect(String(meta.suffixPreview ?? "")).toContain(path1.slice(-8));

    const path2 = `C:\\LM-IT-${randomUUID().slice(0, 8)}`;
    const r2 = await patchAdnSettings(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localDownloadRoot: path2 }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgA }) },
    );
    expect(r2.status).toBe(200);
  });

  it("400 LOCAL_PATH_TOO_LONG", async () => {
    mockSession(ids.adminA, ids.orgA);
    const long = "C:\\" + "x".repeat(520);
    const res = await patchAdnSettings(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localDownloadRoot: long }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgA }) },
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error_code?: string };
    expect(j.error_code).toBe("LOCAL_PATH_TOO_LONG");
  });

  it("membro org A não faz PATCH a org B (NFR31) — 403 conforme handler actual", async () => {
    mockSession(ids.memberA, ids.orgA);
    const res = await patchAdnSettings(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adnSyncEnabled: true }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgB }) },
    );
    expect(res.status).toBe(403);
  });

  it("superadmin com org activa A: PATCH localDownloadRoot em A → 200 (paridade canManageUsers)", async () => {
    mockSession(ids.superCarol, ids.orgA);
    const p = `C:\\Super-${randomUUID().slice(0, 6)}`;
    const res = await patchAdnSettings(
      new Request("http://test/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localDownloadRoot: p }),
      }),
      { params: Promise.resolve({ organizationId: ids.orgA }) },
    );
    expect(res.status).toBe(200);
  });
});

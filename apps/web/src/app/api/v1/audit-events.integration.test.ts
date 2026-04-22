/**
 * ORG-07: verificar persistência de organization_id em audit_events.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { desc, eq, inArray } from "drizzle-orm";
import { auditEvents, organizations, user } from "@repo/db";
import { getDb } from "@/lib/db";
import { insertAuditEvent } from "@/lib/audit";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("audit_events com organization_id (integração)", () => {
  const prefix = `aud_${Date.now()}_`;
  const actorId = `u_${prefix}actor`;
  const orgId = randomUUID();

  beforeAll(async () => {
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
    const db = getDb();
    await db.insert(user).values({
      id: actorId,
      name: "Actor",
      email: `${prefix}actor@itest.local`,
      emailVerified: true,
      isSuperadmin: false,
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "Org audit IT",
      active: true,
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(auditEvents).where(eq(auditEvents.actorUserId, actorId));
    await db.delete(organizations).where(inArray(organizations.id, [orgId]));
    await db.delete(user).where(eq(user.id, actorId));
    delete (globalThis as { __portalDb?: unknown }).__portalDb;
  });

  it("insertAuditEvent grava organization_id consultável", async () => {
    const db = getDb();
    await insertAuditEvent(db, {
      actorUserId: actorId,
      organizationId: orgId,
      eventType: "active_organization_set",
      metadata: { test: true },
    });

    const [row] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorUserId, actorId))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(1);

    expect(row?.organizationId).toBe(orgId);
    expect(row?.eventType).toBe("active_organization_set");
  });
});

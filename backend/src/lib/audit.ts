import { auditEvents } from "@repo/db";
import type { Db } from "@repo/db";

type AuditEventType = "adn_sync_completed" | "adn_sync_failed";

export async function insertAuditEvent(
  db: Db,
  input: {
    actorUserId: string;
    companyId?: string | null;
    organizationId?: string | null;
    eventType: AuditEventType;
    metadata: Record<string, unknown>;
  },
) {
  await db.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    targetUserId: null,
    companyId: input.companyId ?? null,
    organizationId: input.organizationId ?? null,
    eventType: input.eventType,
    metadata: input.metadata,
  });
}

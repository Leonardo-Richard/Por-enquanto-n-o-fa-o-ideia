import { auditEvents } from "@repo/db";
import type { Db } from "@repo/db";

type AuditEventType =
  | "membership_created"
  | "membership_removed"
  | "membership_role_changed"
  | "active_company_set"
  | "active_organization_set"
  | "superadmin_access_company";

export async function insertAuditEvent(
  db: Db,
  input: {
    actorUserId: string;
    targetUserId?: string | null;
    companyId?: string | null;
    organizationId?: string | null;
    eventType: AuditEventType;
    metadata: Record<string, unknown>;
  },
) {
  await db.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId ?? null,
    companyId: input.companyId ?? null,
    organizationId: input.organizationId ?? null,
    eventType: input.eventType,
    metadata: input.metadata,
  });
}

import { and, eq } from "drizzle-orm";
import { adnSyncJobs } from "@repo/db";
import type { Db } from "@repo/db";
import type { PatchJobInput } from "./schemas";
import { resolveAdnAuditActorId } from "./system-audit";
import type { AdnHandlerResult } from "./types";

export type PatchJobAuditFn = (
  db: Db,
  input: {
    actorUserId: string;
    organizationId: string;
    companyId: string;
    eventType: "adn_sync_completed" | "adn_sync_failed";
    metadata: Record<string, unknown>;
  },
) => Promise<void>;

async function safeInsertPatchJobAudit(
  insertAudit: PatchJobAuditFn,
  db: Db,
  input: Parameters<PatchJobAuditFn>[1],
): Promise<void> {
  try {
    await insertAudit(db, input);
  } catch (error) {
    // A actualização do job já foi gravada; a auditoria é complementar.
    // Falhas comuns: actor `system:adn-scheduler` em falta (migração não aplicada).
    console.warn(
      "[adn-internal] PATCH job: evento de auditoria ignorado (job actualizado na mesma):",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function handlePatchJob(
  db: Db,
  jobId: string,
  patch: PatchJobInput,
  insertAudit: PatchJobAuditFn,
): Promise<AdnHandlerResult<{ ok: true }>> {
  const [before] = await db
    .select({
      id: adnSyncJobs.id,
      organizationId: adnSyncJobs.organizationId,
      companyId: adnSyncJobs.companyId,
      status: adnSyncJobs.status,
      requestedByUserId: adnSyncJobs.requestedByUserId,
      trigger: adnSyncJobs.trigger,
    })
    .from(adnSyncJobs)
    .where(and(eq(adnSyncJobs.id, jobId), eq(adnSyncJobs.organizationId, patch.organizationId)))
    .limit(1);
  if (!before) {
    return { ok: false, error: { status: 403, message: "Job não encontrado para esta organização." } };
  }

  await db
    .update(adnSyncJobs)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.summaryJson !== undefined ? { summaryJson: patch.summaryJson } : {}),
      ...(patch.workerCorrelationId !== undefined
        ? { workerCorrelationId: patch.workerCorrelationId }
        : {}),
      ...(patch.http429Count !== undefined ? { http429Count: patch.http429Count } : {}),
      ...(patch.http503Count !== undefined ? { http503Count: patch.http503Count } : {}),
      ...(patch.startedAt !== undefined ? { startedAt: new Date(patch.startedAt) } : {}),
      ...(patch.completedAt !== undefined ? { completedAt: new Date(patch.completedAt) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(adnSyncJobs.id, jobId));

  const actorId = resolveAdnAuditActorId(before.requestedByUserId);
  const nextStatus = patch.status;
  if (actorId && nextStatus !== undefined && nextStatus !== before.status) {
    const meta = {
      adnSyncJobId: jobId,
      trigger: before.trigger,
      actorKind: before.requestedByUserId ? "user" : "system",
    };
    if (nextStatus === "completed") {
      await safeInsertPatchJobAudit(insertAudit, db, {
        actorUserId: actorId,
        organizationId: before.organizationId,
        companyId: before.companyId,
        eventType: "adn_sync_completed",
        metadata: meta,
      });
    } else if (nextStatus === "failed") {
      await safeInsertPatchJobAudit(insertAudit, db, {
        actorUserId: actorId,
        organizationId: before.organizationId,
        companyId: before.companyId,
        eventType: "adn_sync_failed",
        metadata: meta,
      });
    }
  }

  return { ok: true, data: { ok: true } };
}

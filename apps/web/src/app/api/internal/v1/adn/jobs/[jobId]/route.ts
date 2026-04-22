import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adnSyncJobs } from "@repo/db";
import { insertAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { jsonError, toPublicApiError } from "@/server/api/v1/lib/errors";
import { parseInternalAdnBody } from "@/server/api/internal/v1/adn/lib/parse-internal-adn";

const jobStatus = z.enum(["queued", "running", "completed", "partial", "failed"]);

const patchSchema = z
  .object({
    organizationId: z.string().uuid(),
    status: jobStatus.optional(),
    summaryJson: z.record(z.string(), z.unknown()).optional(),
    workerCorrelationId: z.string().max(500).optional(),
    http429Count: z.number().int().nonnegative().optional(),
    http503Count: z.number().int().nonnegative().optional(),
    startedAt: z.string().datetime({ offset: true }).optional(),
    completedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export async function PATCH(request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await ctx.params;
    if (!z.string().uuid().safeParse(jobId).success) {
      return jsonError(400, "jobId inválido.");
    }

    const parsed = await parseInternalAdnBody(request, patchSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const patch = parsed.data;
    const db = getDb();

    const [before] = await db
      .select({
        id: adnSyncJobs.id,
        organizationId: adnSyncJobs.organizationId,
        companyId: adnSyncJobs.companyId,
        status: adnSyncJobs.status,
        requestedByUserId: adnSyncJobs.requestedByUserId,
      })
      .from(adnSyncJobs)
      .where(and(eq(adnSyncJobs.id, jobId), eq(adnSyncJobs.organizationId, patch.organizationId)))
      .limit(1);
    if (!before) {
      return jsonError(403, "Job não encontrado para esta organização.");
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

    const actorId = before.requestedByUserId;
    const nextStatus = patch.status;
    if (actorId && nextStatus !== undefined && nextStatus !== before.status) {
      if (nextStatus === "completed") {
        await insertAuditEvent(db, {
          actorUserId: actorId,
          organizationId: before.organizationId,
          companyId: before.companyId,
          eventType: "adn_sync_completed",
          metadata: { adnSyncJobId: jobId },
        });
      } else if (nextStatus === "failed") {
        await insertAuditEvent(db, {
          actorUserId: actorId,
          organizationId: before.organizationId,
          companyId: before.companyId,
          eventType: "adn_sync_failed",
          metadata: { adnSyncJobId: jobId },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toPublicApiError(e);
  }
}

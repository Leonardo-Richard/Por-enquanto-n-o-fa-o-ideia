import { and, count, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { adnPostSyncBodySchema, canonicalSyncBodyForFingerprint, fingerprintFromCanonical } from "@/lib/adn-sync-body";
import { adnArtifacts, adnSyncJobs } from "@repo/db";
import { insertAuditEvent } from "@/lib/audit";
import { adnPostSyncRateKey, getAdnPublicPostSyncLimit } from "@/lib/adn-rate-limit";
import { consumeDistributedOrLocalRateLimit } from "@/lib/distributed-rate-limit";
import { adnJsonFromZodError } from "@/lib/adn-zod-response";
import { jsonError, toPublicApiError } from "../lib/errors";
import { resolveAdnPublicAccess } from "./adn-public-access";

export async function handleGetAdnSync(request: Request, organizationId: string, companyId: string) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const { ctx } = gate;
    const { db } = ctx;

    const jobsList = await db
      .select({
        id: adnSyncJobs.id,
        status: adnSyncJobs.status,
        trigger: adnSyncJobs.trigger,
        summaryJson: adnSyncJobs.summaryJson,
        createdAt: adnSyncJobs.createdAt,
        updatedAt: adnSyncJobs.updatedAt,
      })
      .from(adnSyncJobs)
      .where(and(eq(adnSyncJobs.organizationId, organizationId), eq(adnSyncJobs.companyId, companyId)))
      .orderBy(desc(adnSyncJobs.createdAt))
      .limit(25);

    const lastRow = jobsList[0] ?? null;
    const ids = jobsList.map((j) => j.id);
    const artifactCounts: Record<string, number> = {};
    if (ids.length > 0) {
      const grouped = await db
        .select({
          jobId: adnArtifacts.adnSyncJobId,
          n: count(adnArtifacts.id),
        })
        .from(adnArtifacts)
        .where(
          and(
            eq(adnArtifacts.organizationId, organizationId),
            eq(adnArtifacts.companyId, companyId),
            isNotNull(adnArtifacts.adnSyncJobId),
            inArray(adnArtifacts.adnSyncJobId, ids),
          ),
        )
        .groupBy(adnArtifacts.adnSyncJobId);
      for (const row of grouped) {
        if (row.jobId) {
          artifactCounts[row.jobId] = Number(row.n);
        }
      }
    }

    const res = NextResponse.json({
      lastJob: lastRow
        ? {
            id: lastRow.id,
            status: lastRow.status,
            trigger: lastRow.trigger,
            summary: lastRow.summaryJson ?? null,
            createdAt: lastRow.createdAt,
            updatedAt: lastRow.updatedAt,
          }
        : null,
      recentJobs: jobsList.map((j) => ({
        id: j.id,
        status: j.status,
        trigger: j.trigger,
        summary: j.summaryJson ?? null,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        artifactCount: artifactCounts[j.id] ?? 0,
      })),
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePostAdnSync(request: Request, organizationId: string, companyId: string) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const { ctx } = gate;
    const { db } = ctx;

    const raw = await request.text();
    let bodyJson: unknown = {};
    if (raw.trim().length > 0) {
      try {
        bodyJson = JSON.parse(raw) as unknown;
      } catch {
        return NextResponse.json(
          { message: "JSON inválido.", error_code: "ADN_INVALID_JSON" },
          { status: 400 },
        );
      }
    }

    const parsedBody = adnPostSyncBodySchema.safeParse(bodyJson);
    if (!parsedBody.success) {
      return adnJsonFromZodError(400, "Corpo inválido.", "ADN_INVALID_SYNC_BODY", parsedBody.error);
    }

    const idemKey = request.headers.get("idempotency-key")?.trim() || null;
    const canonical = canonicalSyncBodyForFingerprint(parsedBody.data);
    const fingerprint = fingerprintFromCanonical(canonical);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (idemKey) {
      const [existing] = await db
        .select()
        .from(adnSyncJobs)
        .where(
          and(
            eq(adnSyncJobs.organizationId, organizationId),
            eq(adnSyncJobs.companyId, companyId),
            eq(adnSyncJobs.idempotencyKey, idemKey),
            eq(adnSyncJobs.idempotencyBodyFingerprint, fingerprint),
            gte(adnSyncJobs.createdAt, since),
          ),
        )
        .orderBy(desc(adnSyncJobs.createdAt))
        .limit(1);
      if (existing) {
        return NextResponse.json(
          { job: { id: existing.id, status: existing.status } },
          { status: 202 },
        );
      }
    }

    const lim = getAdnPublicPostSyncLimit();
    const rl = await consumeDistributedOrLocalRateLimit({
      key: adnPostSyncRateKey(ctx.session.user.id, organizationId, companyId),
      max: lim.max,
      windowMs: lim.windowMs,
    });
    if (!rl.ok) {
      console.info(
        JSON.stringify({
          scope: "rate_limit_429",
          route: "adn_sync_post",
          organizationId,
          companyId,
          userId: ctx.session.user.id,
          retryAfterSec: rl.retryAfterSec,
        }),
      );
      const res = NextResponse.json(
        {
          message: "Limite de pedidos de sincronização ADN excedido. Tente novamente dentro de instantes.",
          error_code: "ADN_RATE_LIMIT",
        },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(rl.retryAfterSec));
      return res;
    }

    if (parsedBody.data.remirrorFromJobId) {
      const sourceId = parsedBody.data.remirrorFromJobId;
      const [src] = await db
        .select()
        .from(adnSyncJobs)
        .where(
          and(
            eq(adnSyncJobs.id, sourceId),
            eq(adnSyncJobs.organizationId, organizationId),
            eq(adnSyncJobs.companyId, companyId),
          ),
        )
        .limit(1);
      if (!src) {
        return jsonError(404, "Job de origem não encontrado.");
      }
      if (src.status !== "completed" && src.status !== "partial" && src.status !== "failed") {
        return NextResponse.json(
          {
            message:
              "Só é possível espelhar após o job terminar (estado concluído, parcial ou falhou).",
            error_code: "ADN_REMIRROR_NOT_TERMINAL",
          },
          { status: 400 },
        );
      }
      const [cntRow] = await db
        .select({ n: count(adnArtifacts.id) })
        .from(adnArtifacts)
        .where(
          and(
            eq(adnArtifacts.adnSyncJobId, sourceId),
            eq(adnArtifacts.organizationId, organizationId),
            eq(adnArtifacts.companyId, companyId),
          ),
        );
      const artifactTotal = Number(cntRow?.n ?? 0);
      if (artifactTotal <= 0) {
        return NextResponse.json(
          {
            message: "Este job não tem artefactos no portal para gravar na pasta raiz.",
            error_code: "ADN_REMIRROR_NO_ARTIFACTS",
          },
          { status: 400 },
        );
      }

      const [remirrorJob] = await db
        .insert(adnSyncJobs)
        .values({
          organizationId,
          companyId,
          status: "queued",
          trigger: "retry",
          requestedByUserId: ctx.session.user.id,
          idempotencyKey: idemKey,
          idempotencyBodyFingerprint: idemKey ? fingerprint : null,
          summaryJson: {
            phase: "queued",
            message: "Pedido de espelho na pasta raiz a partir de job concluído.",
            remirrorFromJobId: sourceId,
          },
        })
        .returning({ id: adnSyncJobs.id, status: adnSyncJobs.status });

      if (!remirrorJob) {
        return jsonError(500, "Não foi possível criar o job.");
      }

      await insertAuditEvent(db, {
        actorUserId: ctx.session.user.id,
        organizationId,
        companyId,
        eventType: "adn_sync_requested",
        metadata: { adnSyncJobId: remirrorJob.id, remirrorFromJobId: sourceId },
      });

      return NextResponse.json({ job: { id: remirrorJob.id, status: remirrorJob.status } }, { status: 202 });
    }

    const [job] = await db
      .insert(adnSyncJobs)
      .values({
        organizationId,
        companyId,
        status: "queued",
        trigger: "manual",
        requestedByUserId: ctx.session.user.id,
        idempotencyKey: idemKey,
        idempotencyBodyFingerprint: idemKey ? fingerprint : null,
        summaryJson: {
          phase: "queued",
          message: "Pedido recebido.",
          fetchMode: parsedBody.data.fetchMode ?? "incremental",
        },
      })
      .returning({ id: adnSyncJobs.id, status: adnSyncJobs.status });

    if (!job) {
      return jsonError(500, "Não foi possível criar o job.");
    }

    await insertAuditEvent(db, {
      actorUserId: ctx.session.user.id,
      organizationId,
      companyId,
      eventType: "adn_sync_requested",
      metadata: { adnSyncJobId: job.id },
    });

    return NextResponse.json({ job: { id: job.id, status: job.status } }, { status: 202 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

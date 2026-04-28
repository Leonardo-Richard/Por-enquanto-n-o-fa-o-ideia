import { and, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { adnPostSyncBodySchema, canonicalSyncBodyForFingerprint, fingerprintFromCanonical } from "@/lib/adn-sync-body";
import { adnSyncJobs } from "@repo/db";
import { insertAuditEvent } from "@/lib/audit";
import {
  adnPostSyncRateKey,
  consumeAdnRateLimit,
  getAdnPublicPostSyncLimit,
} from "@/lib/adn-rate-limit";
import { adnJsonFromZodError } from "@/lib/adn-zod-response";
import { jsonError, toPublicApiError } from "../lib/errors";
import { assertAdnOrgAdmin, resolveAdnPublicAccess } from "./adn-public-access";

export async function handleGetAdnSync(request: Request, organizationId: string, companyId: string) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const { ctx } = gate;
    const { db } = ctx;

    const [job] = await db
      .select()
      .from(adnSyncJobs)
      .where(and(eq(adnSyncJobs.organizationId, organizationId), eq(adnSyncJobs.companyId, companyId)))
      .orderBy(desc(adnSyncJobs.createdAt))
      .limit(1);

    const res = NextResponse.json({
      lastJob: job
        ? {
            id: job.id,
            status: job.status,
            trigger: job.trigger,
            summary: job.summaryJson ?? null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          }
        : null,
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
    const adminBlock = assertAdnOrgAdmin(ctx);
    if (adminBlock) {
      return adminBlock;
    }

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
    const rl = consumeAdnRateLimit({
      key: adnPostSyncRateKey(ctx.session.user.id, organizationId, companyId),
      max: lim.max,
      windowMs: lim.windowMs,
    });
    if (!rl.ok) {
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

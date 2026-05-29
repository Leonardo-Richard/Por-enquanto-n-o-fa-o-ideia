import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { adnSyncJobs, companies } from "@repo/db";
import type { AdnExecutionsOverviewResponse } from "@repo/shared";
import { adnSyncJobStatusSchema, adnSyncJobTriggerSchema, maskCnpjDigits } from "@repo/shared";
import {
  adnExecutionsOverviewRateKey,
  getAdnPublicExecutionsOverviewLimit,
} from "@/lib/adn-rate-limit";
import { adnJobDetailLabel } from "@/lib/adn-executions-display";
import { consumeDistributedOrLocalRateLimit } from "@/lib/distributed-rate-limit";
import { resolveAdnOrganizationPublicAccess } from "@/server/api/v1/handlers/adn-public-access";
import { toPublicApiError } from "@/server/api/v1/lib/errors";

function staleQueuedHours(): number {
  const raw = process.env.ADN_STALE_QUEUED_HOURS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 2;
  return Number.isFinite(n) && n > 0 ? n : 2;
}

export async function handleGetAdnExecutionsOverview(request: Request, organizationId: string) {
  try {
    const gate = await resolveAdnOrganizationPublicAccess(request, organizationId);
    if (!gate.ok) {
      return gate.response;
    }
    const { ctx } = gate;
    const { db } = ctx;

    const lim = getAdnPublicExecutionsOverviewLimit();
    const rl = await consumeDistributedOrLocalRateLimit({
      key: adnExecutionsOverviewRateKey(ctx.session.user.id, organizationId),
      max: lim.max,
      windowMs: lim.windowMs,
    });
    if (!rl.ok) {
      const res = NextResponse.json(
        {
          message: "Limite de pedidos excedido. Tente novamente dentro de instantes.",
          error_code: "ADN_RATE_LIMIT",
          retryAfterSeconds: rl.retryAfterSec,
        },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(rl.retryAfterSec));
      return res;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleBefore = new Date(Date.now() - staleQueuedHours() * 60 * 60 * 1000);

    const countRows = await db
      .select({
        status: adnSyncJobs.status,
        n: sql<number>`count(*)::int`,
      })
      .from(adnSyncJobs)
      .where(eq(adnSyncJobs.organizationId, organizationId))
      .groupBy(adnSyncJobs.status);

    const counts = {
      queued: 0,
      running: 0,
      failed: 0,
      completed: 0,
      partial: 0,
    };
    for (const row of countRows) {
      const st = row.status;
      const n = Number(row.n) || 0;
      if (st === "queued") counts.queued = n;
      else if (st === "running") counts.running = n;
      else if (st === "failed") counts.failed = n;
      else if (st === "completed") counts.completed = n;
      else if (st === "partial") counts.partial = n;
    }

    const [failedLast7dRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(adnSyncJobs)
      .where(
        and(
          eq(adnSyncJobs.organizationId, organizationId),
          eq(adnSyncJobs.status, "failed"),
          gte(adnSyncJobs.updatedAt, sevenDaysAgo),
        ),
      );

    const [staleQueuedRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(adnSyncJobs)
      .where(
        and(
          eq(adnSyncJobs.organizationId, organizationId),
          eq(adnSyncJobs.status, "queued"),
          lt(adnSyncJobs.updatedAt, staleBefore),
        ),
      );

    const lastPerCompany = await db.execute<{
      id: string;
      company_id: string;
      status: string;
      trigger: string;
      summary_json: Record<string, unknown> | null;
      updated_at: Date;
      cnpj_digits: string;
    }>(sql`
      SELECT DISTINCT ON (j.company_id)
        j.id,
        j.company_id,
        j.status,
        j.trigger,
        j.summary_json,
        j.updated_at,
        c.cnpj_digits
      FROM adn_sync_jobs j
      INNER JOIN companies c ON c.id = j.company_id
      WHERE j.organization_id = ${organizationId}::uuid
      ORDER BY j.company_id, j.created_at DESC, j.id DESC
    `);

    const lastJobByCompanyId: AdnExecutionsOverviewResponse["lastJobByCompanyId"] = {};
    for (const row of Array.from(lastPerCompany) as Array<{
      id: string;
      company_id: string;
      status: string;
      trigger: string;
      summary_json: Record<string, unknown> | null;
      updated_at: Date;
    }>) {
      const summary =
        row.summary_json && typeof row.summary_json === "object" ? row.summary_json : null;
      lastJobByCompanyId[row.company_id] = {
        jobId: row.id,
        status: adnSyncJobStatusSchema.safeParse(row.status).success
          ? adnSyncJobStatusSchema.parse(row.status)
          : "failed",
        trigger: adnSyncJobTriggerSchema.safeParse(row.trigger).success
          ? adnSyncJobTriggerSchema.parse(row.trigger)
          : "manual",
        updatedAt: new Date(row.updated_at).toISOString(),
        detailLabel: adnJobDetailLabel({ status: row.status, summary }),
      };
    }

    const failureRows = await db
      .select({
        id: adnSyncJobs.id,
        companyId: adnSyncJobs.companyId,
        status: adnSyncJobs.status,
        summaryJson: adnSyncJobs.summaryJson,
        updatedAt: adnSyncJobs.updatedAt,
        cnpjDigits: companies.cnpjDigits,
      })
      .from(adnSyncJobs)
      .innerJoin(companies, eq(companies.id, adnSyncJobs.companyId))
      .where(
        and(
          eq(adnSyncJobs.organizationId, organizationId),
          eq(adnSyncJobs.status, "failed"),
          gte(adnSyncJobs.updatedAt, sevenDaysAgo),
        ),
      )
      .orderBy(desc(adnSyncJobs.updatedAt))
      .limit(5);

    const recentFailures = failureRows.map((r) => ({
      jobId: r.id,
      companyId: r.companyId,
      companyCnpjMasked: maskCnpjDigits(r.cnpjDigits),
      updatedAt: r.updatedAt.toISOString(),
      detailLabel: adnJobDetailLabel({
        status: r.status,
        summary: r.summaryJson ?? null,
      }),
    }));

    const body: AdnExecutionsOverviewResponse = {
      counts,
      attention: {
        failedLast7d: Number(failedLast7dRow?.n) || 0,
        staleQueued: Number(staleQueuedRow?.n) || 0,
      },
      lastJobByCompanyId,
      recentFailures,
    };

    const res = NextResponse.json(body);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

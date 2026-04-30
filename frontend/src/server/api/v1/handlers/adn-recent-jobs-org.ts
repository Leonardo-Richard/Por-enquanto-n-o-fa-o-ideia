/**
 * GET /api/v1/organizations/:organizationId/adn/recent-jobs
 *
 * Paginação por cursor opaque (base64url JSON { ca: ISO created_at, id: uuid }).
 * Ordenação fixa: created_at DESC, id DESC (desempate).
 */
import { Buffer } from "node:buffer";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { adnSyncJobs, companies } from "@repo/db";
import { maskCnpjDigits } from "@repo/shared";
import {
  adnRecentJobsRateKey,
  getAdnPublicRecentJobsLimit,
} from "@/lib/adn-rate-limit";
import { consumeDistributedOrLocalRateLimit } from "@/lib/distributed-rate-limit";
import { resolveAdnOrganizationPublicAccess } from "@/server/api/v1/handlers/adn-public-access";
import { jsonError, toPublicApiError } from "@/server/api/v1/lib/errors";

type CursorPayload = {
  /** ISO 8601 — mesmo valor que gravado em DB */
  ca: string;
  id: string;
};

function encodeCursor(createdAt: Date, id: string): string {
  const payload: CursorPayload = { ca: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeRecentJobsCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as CursorPayload;
    if (!j?.ca || !j?.id || typeof j.ca !== "string" || typeof j.id !== "string") {
      return null;
    }
    const createdAt = new Date(j.ca);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: j.id };
  } catch {
    return null;
  }
}

export async function handleGetAdnRecentJobsOrg(request: Request, organizationId: string) {
  try {
    const gate = await resolveAdnOrganizationPublicAccess(request, organizationId);
    if (!gate.ok) {
      return gate.response;
    }
    const { ctx } = gate;
    const { db } = ctx;

    const lim = getAdnPublicRecentJobsLimit();
    const rl = await consumeDistributedOrLocalRateLimit({
      key: adnRecentJobsRateKey(ctx.session.user.id, organizationId),
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

    const url = new URL(request.url);
    let limit = 25;
    const limitParam = url.searchParams.get("limit");
    if (limitParam) {
      const n = Number.parseInt(limitParam, 10);
      if (Number.isFinite(n) && n > 0) {
        limit = Math.min(100, n);
      }
    }

    const cursorRaw = url.searchParams.get("cursor")?.trim();
    const cursor = cursorRaw ? decodeRecentJobsCursor(cursorRaw) : null;
    if (cursorRaw && !cursor) {
      return jsonError(400, "Parâmetro cursor inválido.");
    }

    const conditions = [eq(adnSyncJobs.organizationId, organizationId)];
    if (cursor) {
      conditions.push(
        or(
          lt(adnSyncJobs.createdAt, cursor.createdAt),
          and(eq(adnSyncJobs.createdAt, cursor.createdAt), lt(adnSyncJobs.id, cursor.id)),
        )!,
      );
    }

    const rows = await db
      .select({
        id: adnSyncJobs.id,
        companyId: adnSyncJobs.companyId,
        status: adnSyncJobs.status,
        trigger: adnSyncJobs.trigger,
        summaryJson: adnSyncJobs.summaryJson,
        createdAt: adnSyncJobs.createdAt,
        updatedAt: adnSyncJobs.updatedAt,
        cnpjDigits: companies.cnpjDigits,
      })
      .from(adnSyncJobs)
      .innerJoin(companies, eq(companies.id, adnSyncJobs.companyId))
      .where(and(...conditions))
      .orderBy(desc(adnSyncJobs.createdAt), desc(adnSyncJobs.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    const jobs = pageRows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyCnpjMasked: maskCnpjDigits(r.cnpjDigits),
      status: r.status,
      trigger: r.trigger,
      summary: r.summaryJson ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const res = NextResponse.json({
      jobs,
      nextCursor,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

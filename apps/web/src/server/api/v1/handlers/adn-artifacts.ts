import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adnArtifacts } from "@repo/db";
import { adnJsonFromZodError } from "@/lib/adn-zod-response";
import { toPublicApiError } from "../lib/errors";
import { resolveAdnPublicAccess } from "./adn-public-access";

const listQuery = z.object({
  issuedFrom: z.string().optional(),
  issuedTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().uuid().optional(),
});

function maskAccessKey(accessKey: string): string {
  if (accessKey.length < 10) {
    return "****";
  }
  return `${accessKey.slice(0, 6)}…${accessKey.slice(-4)}`;
}

export async function handleGetAdnArtifacts(request: Request, organizationId: string, companyId: string) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const { db } = gate.ctx;

    const url = new URL(request.url);
    const q = listQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!q.success) {
      return adnJsonFromZodError(400, "Parâmetros inválidos.", "ADN_INVALID_QUERY", q.error);
    }
    const { issuedFrom, issuedTo, limit, cursor } = q.data;

    let whereExpr = and(
      eq(adnArtifacts.organizationId, organizationId),
      eq(adnArtifacts.companyId, companyId),
    );
    if (issuedFrom) {
      const d = new Date(`${issuedFrom}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) {
        whereExpr = and(whereExpr, gte(adnArtifacts.issuedAt, d));
      }
    }
    if (issuedTo) {
      const d = new Date(`${issuedTo}T23:59:59.999Z`);
      if (!Number.isNaN(d.getTime())) {
        whereExpr = and(whereExpr, lte(adnArtifacts.issuedAt, d));
      }
    }
    if (cursor) {
      const [cRow] = await db
        .select({ issuedAt: adnArtifacts.issuedAt })
        .from(adnArtifacts)
        .where(and(eq(adnArtifacts.id, cursor), eq(adnArtifacts.companyId, companyId)))
        .limit(1);
      if (cRow?.issuedAt) {
        whereExpr = and(whereExpr, lte(adnArtifacts.issuedAt, cRow.issuedAt));
      }
    }

    const rows = await db
      .select({
        id: adnArtifacts.id,
        kind: adnArtifacts.kind,
        issuedAt: adnArtifacts.issuedAt,
        contentSha256: adnArtifacts.contentSha256,
        accessKey: adnArtifacts.accessKey,
      })
      .from(adnArtifacts)
      .where(whereExpr)
      .orderBy(desc(adnArtifacts.issuedAt))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const next = rows.length > limit ? page[page.length - 1]?.id : null;

    const items = page.map((r) => ({
      id: r.id,
      kind: r.kind,
      issuedAt: r.issuedAt,
      contentSha256: r.contentSha256,
      accessKeyMasked: maskAccessKey(r.accessKey),
    }));

    const res = NextResponse.json({ items, nextCursor: next });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

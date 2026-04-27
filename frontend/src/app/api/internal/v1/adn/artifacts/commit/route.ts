import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adnArtifacts, adnArtifactDrafts, adnSyncJobs } from "@repo/db";
import { getDb } from "@/lib/db";
import { maybeForwardInternalApi } from "@/lib/internal-api-forward";
import { jsonError, toPublicApiError } from "@/server/api/v1/lib/errors";
import { parseInternalAdnBody } from "@/server/api/internal/v1/adn/lib/parse-internal-adn";

const commitSchema = z
  .object({
    artifactDraftId: z.string().uuid(),
    issuedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "issuedAt inválido."),
    byteSize: z.number().int().nonnegative().optional(),
    contentType: z.string().max(200).optional(),
    adnSyncJobId: z.string().uuid().optional(),
  })
  .strict();

function maskAccessKey(accessKey: string): { prefix: string; suffix: string } {
  if (accessKey.length < 8) {
    return { prefix: "", suffix: "" };
  }
  return { prefix: accessKey.slice(0, 6), suffix: accessKey.slice(-4) };
}

export async function POST(request: Request) {
  try {
    const forwarded = await maybeForwardInternalApi(request);
    if (forwarded) {
      return forwarded;
    }
    const parsed = await parseInternalAdnBody(request, commitSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const { artifactDraftId, issuedAt, byteSize, contentType, adnSyncJobId } = parsed.data;
    const db = getDb();

    const [draft] = await db
      .select()
      .from(adnArtifactDrafts)
      .where(eq(adnArtifactDrafts.id, artifactDraftId))
      .limit(1);
    if (!draft) {
      return jsonError(400, "Rascunho inexistente.", { error_code: "ADN_DRAFT_NOT_FOUND" });
    }
    if (new Date(draft.expiresAt).getTime() < Date.now()) {
      await db.delete(adnArtifactDrafts).where(eq(adnArtifactDrafts.id, artifactDraftId));
      return jsonError(400, "Rascunho expirado.", { error_code: "ADN_DRAFT_EXPIRED" });
    }

    const issued = new Date(issuedAt);
    const { prefix, suffix } = maskAccessKey(draft.accessKey);

    const inserted = await db
      .insert(adnArtifacts)
      .values({
        organizationId: draft.organizationId,
        companyId: draft.companyId,
        adnSyncJobId: adnSyncJobId ?? null,
        accessKey: draft.accessKey,
        accessKeyPrefix: prefix || null,
        accessKeySuffix: suffix || null,
        kind: draft.kind,
        contentSha256: draft.contentSha256,
        storageBucket: draft.storageBucket,
        storageObjectKey: draft.storageObjectKey,
        contentType: contentType ?? null,
        issuedAt: issued,
        byteSize: byteSize ?? null,
      })
      .onConflictDoNothing({ target: [adnArtifacts.companyId, adnArtifacts.accessKey, adnArtifacts.kind] })
      .returning({ id: adnArtifacts.id });

    let artifactId: string;
    if (inserted.length > 0 && inserted[0]) {
      artifactId = inserted[0].id;
    } else {
      const [existing] = await db
        .select({ id: adnArtifacts.id })
        .from(adnArtifacts)
        .where(
          and(
            eq(adnArtifacts.companyId, draft.companyId),
            eq(adnArtifacts.accessKey, draft.accessKey),
            eq(adnArtifacts.kind, draft.kind),
          ),
        )
        .limit(1);
      if (!existing) {
        return jsonError(500, "Falha idempotente inesperada.");
      }
      artifactId = existing.id;
    }

    await db.delete(adnArtifactDrafts).where(eq(adnArtifactDrafts.id, artifactDraftId));

    if (adnSyncJobId) {
      await db
        .update(adnSyncJobs)
        .set({
          updatedAt: new Date(),
          summaryJson: { lastArtifactId: artifactId },
        })
        .where(and(eq(adnSyncJobs.id, adnSyncJobId), eq(adnSyncJobs.organizationId, draft.organizationId)));
    }

    return NextResponse.json({ artifactId, deduplicated: inserted.length === 0 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adnStorageBucket, canonicalAdnObjectPath, createAdnPresignedPutUrl } from "@/lib/adn-storage";
import { getDb } from "@/lib/db";
import { maybeForwardInternalApi } from "@/lib/internal-api-forward";
import { adnArtifactDrafts, companies, organizations } from "@repo/db";
import { jsonError, toPublicApiError } from "@/server/api/v1/lib/errors";
import { parseInternalAdnBody } from "@/server/api/internal/v1/adn/lib/parse-internal-adn";

const prepareSchema = z
  .object({
    organizationId: z.string().uuid(),
    companyId: z.string().uuid(),
    accessKey: z.string().length(44),
    sha256: z
      .string()
      .length(64)
      .transform((s) => s.toLowerCase())
      .refine((s) => /^[0-9a-f]+$/.test(s), "sha256 inválido."),
    contentType: z.string().min(1).max(200),
    kind: z.enum(["xml", "pdf"]).default("xml"),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const forwarded = await maybeForwardInternalApi(request);
    if (forwarded) {
      return forwarded;
    }
    const parsed = await parseInternalAdnBody(request, prepareSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const { organizationId, companyId, accessKey, sha256, contentType, kind } = parsed.data;
    const db = getDb();

    const [org] = await db
      .select({ id: organizations.id, adnSyncEnabled: organizations.adnSyncEnabled })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) {
      return jsonError(403, "Operação não permitida.");
    }
    if (!org.adnSyncEnabled) {
      return jsonError(403, "Sincronização ADN desactivada para esta organização.");
    }

    const [co] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
      .limit(1);
    if (!co) {
      return jsonError(403, "Operação não permitida.");
    }

    const objectPath = canonicalAdnObjectPath(organizationId, companyId, accessKey, kind);
    const bucket = adnStorageBucket();
    const expiresAtDraft = new Date(Date.now() + 15 * 60 * 1000);

    const [draft] = await db
      .insert(adnArtifactDrafts)
      .values({
        organizationId,
        companyId,
        accessKey,
        kind,
        contentSha256: sha256,
        storageBucket: bucket,
        storageObjectKey: objectPath,
        expiresAt: expiresAtDraft,
      })
      .returning({ id: adnArtifactDrafts.id });

    if (!draft) {
      return jsonError(500, "Não foi possível criar rascunho de artefacto.");
    }

    const { signedUrl, expiresAt } = await createAdnPresignedPutUrl(objectPath);

    return NextResponse.json({
      artifactDraftId: draft.id,
      uploadUrl: signedUrl,
      expiresAt,
      putHeaders: {
        "Content-Type": contentType,
      },
      storageBucket: bucket,
      storageObjectKey: objectPath,
    });
  } catch (e) {
    return toPublicApiError(e);
  }
}

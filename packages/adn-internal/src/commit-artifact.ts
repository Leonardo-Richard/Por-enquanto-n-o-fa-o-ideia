import { and, eq } from "drizzle-orm";
import { adnArtifactDrafts, adnArtifacts, adnSyncJobs } from "@repo/db";
import type { Db } from "@repo/db";
import type { CommitArtifactInput } from "./schemas";
import { assertOrgCompanyAdnEnabled } from "./validate-org-company";
import { sha256Hex } from "./sha256";
import type { AdnHandlerResult } from "./types";

export type CommitArtifactDeps = {
  /** Quando definido, verifica SHA-256 do objecto no storage antes do commit. */
  downloadObjectBytes?: (bucket: string, objectPath: string) => Promise<Uint8Array>;
};

function maskAccessKey(accessKey: string): { prefix: string; suffix: string } {
  if (accessKey.length < 8) return { prefix: "", suffix: "" };
  return { prefix: accessKey.slice(0, 6), suffix: accessKey.slice(-4) };
}

export async function handleCommitArtifact(
  db: Db,
  input: CommitArtifactInput,
  deps: CommitArtifactDeps = {},
): Promise<AdnHandlerResult<{ artifactId: string; deduplicated: boolean }>> {
  const { artifactDraftId, issuedAt, byteSize, contentType, adnSyncJobId } = input;

  const [draft] = await db
    .select()
    .from(adnArtifactDrafts)
    .where(eq(adnArtifactDrafts.id, artifactDraftId))
    .limit(1);
  if (!draft) {
    return {
      ok: false,
      error: {
        status: 400,
        message: "Rascunho inexistente.",
        error_code: "ADN_DRAFT_NOT_FOUND",
      },
    };
  }
  if (new Date(draft.expiresAt).getTime() < Date.now()) {
    await db.delete(adnArtifactDrafts).where(eq(adnArtifactDrafts.id, artifactDraftId));
    return {
      ok: false,
      error: {
        status: 400,
        message: "Rascunho expirado.",
        error_code: "ADN_DRAFT_EXPIRED",
      },
    };
  }

  const orgCheck = await assertOrgCompanyAdnEnabled(db, draft.organizationId, draft.companyId);
  if (!orgCheck.ok) return orgCheck;

  if (deps.downloadObjectBytes) {
    try {
      const bytes = await deps.downloadObjectBytes(draft.storageBucket, draft.storageObjectKey);
      const actual = sha256Hex(bytes);
      if (actual !== draft.contentSha256.toLowerCase()) {
        return {
          ok: false,
          error: {
            status: 400,
            message: "Conteúdo no storage não corresponde ao hash do rascunho.",
            error_code: "ADN_STORAGE_HASH_MISMATCH",
          },
        };
      }
    } catch {
      return {
        ok: false,
        error: {
          status: 400,
          message: "Objecto ainda não disponível no storage ou inacessível.",
          error_code: "ADN_STORAGE_OBJECT_MISSING",
        },
      };
    }
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
      return {
        ok: false,
        error: { status: 500, message: "Falha idempotente inesperada." },
      };
    }
    artifactId = existing.id;
  }

  await db.delete(adnArtifactDrafts).where(eq(adnArtifactDrafts.id, artifactDraftId));

  if (adnSyncJobId) {
    await db
      .update(adnSyncJobs)
      .set({ updatedAt: new Date(), summaryJson: { lastArtifactId: artifactId } })
      .where(
        and(eq(adnSyncJobs.id, adnSyncJobId), eq(adnSyncJobs.organizationId, draft.organizationId)),
      );
  }

  return { ok: true, data: { artifactId, deduplicated: inserted.length === 0 } };
}

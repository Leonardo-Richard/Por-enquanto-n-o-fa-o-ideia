import type { Db } from "@repo/db";
import { adnArtifactDrafts } from "@repo/db";
import type { PrepareUploadInput } from "./schemas.js";
import { assertOrgCompanyAdnEnabled } from "./validate-org-company.js";
import type { AdnHandlerResult } from "./types.js";

export type PrepareUploadDeps = {
  storageBucket: string;
  canonicalObjectPath: (
    organizationId: string,
    companyId: string,
    accessKey: string,
    kind: "xml" | "pdf",
  ) => string;
  createPresignedPutUrl: (objectPath: string) => Promise<{
    signedUrl: string;
    expiresAt: string;
    expiresIn: number;
  }>;
};

export async function handlePrepareUpload(
  db: Db,
  input: PrepareUploadInput,
  deps: PrepareUploadDeps,
): Promise<
  AdnHandlerResult<{
    artifactDraftId: string;
    uploadUrl: string;
    expiresAt: string;
    putHeaders: { "Content-Type": string };
    storageBucket: string;
    storageObjectKey: string;
  }>
> {
  const { organizationId, companyId, accessKey, sha256, contentType, kind } = input;

  const orgCheck = await assertOrgCompanyAdnEnabled(db, organizationId, companyId);
  if (!orgCheck.ok) return orgCheck;

  const objectPath = deps.canonicalObjectPath(organizationId, companyId, accessKey, kind);
  const bucket = deps.storageBucket;
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
    return { ok: false, error: { status: 500, message: "Não foi possível criar rascunho de artefacto." } };
  }

  const { signedUrl, expiresAt } = await deps.createPresignedPutUrl(objectPath);

  return {
    ok: true,
    data: {
      artifactDraftId: draft.id,
      uploadUrl: signedUrl,
      expiresAt,
      putHeaders: { "Content-Type": contentType },
      storageBucket: bucket,
      storageObjectKey: objectPath,
    },
  };
}

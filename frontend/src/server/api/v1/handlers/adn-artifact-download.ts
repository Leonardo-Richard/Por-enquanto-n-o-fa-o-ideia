import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createAdnPresignedGetUrl } from "@/lib/adn-storage";
import { adnArtifacts } from "@repo/db";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { resolveAdnPublicAccess } from "./adn-public-access";

export async function handleGetAdnArtifactDownload(
  request: Request,
  organizationId: string,
  companyId: string,
  artifactId: string,
) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const { db, session } = gate.ctx;

    const [art] = await db
      .select({
        id: adnArtifacts.id,
        storageObjectKey: adnArtifacts.storageObjectKey,
      })
      .from(adnArtifacts)
      .where(
        and(
          eq(adnArtifacts.id, artifactId),
          eq(adnArtifacts.companyId, companyId),
          eq(adnArtifacts.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!art) {
      return jsonError(404, "Recurso não encontrado.");
    }

    const { signedUrl, expiresAt } = await createAdnPresignedGetUrl(art.storageObjectKey);

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      organizationId,
      companyId,
      eventType: "adn_artifact_downloaded",
      metadata: { artifactId: art.id },
    });

    return NextResponse.json({ downloadUrl: signedUrl, expiresAt });
  } catch (e) {
    return toPublicApiError(e);
  }
}

import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  adnPdfsZipMaxCount,
  adnPdfsZipMaxTotalBytes,
  downloadAdnObjectBytes,
} from "@/lib/adn-storage";
import { insertAuditEvent } from "@/lib/audit";
import { adnArtifacts, companies } from "@repo/db";
import { jsonError, toPublicApiError } from "../lib/errors";
import { resolveAdnPublicAccess } from "./adn-public-access";

function zipFilename(cnpjDigits: string): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `pdfs-${cnpjDigits}-${ymd}.zip`;
}

function streamToWebReadable(nodeStream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

export async function handleGetAdnArtifactsPdfsZip(
  request: Request,
  organizationId: string,
  companyId: string,
) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const { db, session } = gate.ctx;

    const [company] = await db
      .select({ cnpjDigits: companies.cnpjDigits })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
      .limit(1);
    if (!company) {
      return jsonError(404, "Recurso não encontrado.");
    }

    const rows = await db
      .select({
        id: adnArtifacts.id,
        accessKey: adnArtifacts.accessKey,
        storageObjectKey: adnArtifacts.storageObjectKey,
        byteSize: adnArtifacts.byteSize,
      })
      .from(adnArtifacts)
      .where(
        and(
          eq(adnArtifacts.organizationId, organizationId),
          eq(adnArtifacts.companyId, companyId),
          eq(adnArtifacts.kind, "pdf"),
        ),
      )
      .orderBy(desc(adnArtifacts.issuedAt));

    if (rows.length === 0) {
      return jsonError(404, "Sem PDFs para esta empresa.");
    }

    const maxCount = adnPdfsZipMaxCount();
    const maxBytes = adnPdfsZipMaxTotalBytes();
    if (rows.length > maxCount) {
      return jsonError(
        413,
        `Demasiados PDFs (${rows.length}). O limite por pedido é ${maxCount}. Contacte o suporte se precisar de mais.`,
      );
    }

    let totalBytes = 0;
    for (const r of rows) {
      if (r.byteSize != null && r.byteSize > 0) {
        totalBytes += r.byteSize;
      }
    }
    if (totalBytes > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      return jsonError(
        413,
        `O volume total de PDFs excede o limite de ${mb} MB por pedido. Tente filtrar por período ou contacte o suporte.`,
      );
    }

    const pass = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err: Error) => {
      pass.destroy(err);
    });
    archive.pipe(pass);

    for (const row of rows) {
      let bytes: Uint8Array;
      try {
        bytes = await downloadAdnObjectBytes(row.storageObjectKey);
      } catch (e) {
        console.error("[adn-pdfs-zip] storage download failed", {
          artifactId: row.id,
          message: e instanceof Error ? e.message : String(e),
        });
        return jsonError(503, "Serviço temporariamente indisponível. Tente mais tarde.");
      }
      archive.append(Buffer.from(bytes), { name: `${row.accessKey}.pdf` });
    }

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      organizationId,
      companyId,
      eventType: "adn_artifacts_bulk_downloaded",
      metadata: { count: rows.length, totalBytes },
    });

    void archive.finalize();

    const filename = zipFilename(company.cnpjDigits);
    return new NextResponse(streamToWebReadable(pass), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return toPublicApiError(e);
  }
}

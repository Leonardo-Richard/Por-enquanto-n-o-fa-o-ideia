import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  certUploadMessageForCode,
  companyCertificateGetResponseSchema,
  type CertUploadErrorCode,
} from "@repo/shared";
import { companies, companyCertificateAudits, companyCertificates } from "@repo/db";
import { getCertUploadMaxBytes, isCertUploadApiEnabled } from "@/lib/cert-upload-env";
import { consumeCertUploadRateLimitAsync } from "@/lib/cert-upload-rate-limit";
import { validatePkcs12ForCompany } from "@/lib/validate-pkcs12-for-company";
import { deleteCertificateVaultObject, writeCertificateToVault } from "@/server/cert-upload/cert-upload-vault";
import { toPublicApiError } from "@/server/api/v1/lib/errors";
import { assertAdnOrgAdmin, resolveAdnPublicAccess, type AdnAccessContext } from "./adn-public-access";

function notFoundWhenApiOff(): NextResponse {
  return NextResponse.json({ message: "Recurso não encontrado." }, { status: 404 });
}

function forbiddenCertRegistration(): NextResponse {
  return NextResponse.json(
    { message: "Não tem permissão para registar o certificado." },
    { status: 403 },
  );
}

function canOrgAdminMutate(ctx: AdnAccessContext): boolean {
  return assertAdnOrgAdmin(ctx) === null;
}

async function loadCompanyCnpjDigits(
  ctx: AdnAccessContext,
): Promise<{ cnpjDigits: string } | { error: NextResponse }> {
  const [row] = await ctx.db
    .select({ cnpjDigits: companies.cnpjDigits })
    .from(companies)
    .where(and(eq(companies.id, ctx.companyId), eq(companies.organizationId, ctx.organizationId)))
    .limit(1);
  if (!row?.cnpjDigits) {
    return { error: NextResponse.json({ message: "Recurso não encontrado." }, { status: 404 }) };
  }
  return { cnpjDigits: row.cnpjDigits };
}

function formatDateOnlyUtc(d: Date | string): string {
  if (typeof d === "string") {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function jsonCertError(status: number, code: CertUploadErrorCode, maxMb?: number): NextResponse {
  return NextResponse.json(
    { message: certUploadMessageForCode(code, maxMb), error_code: code },
    { status },
  );
}

export async function handleGetCompanyCertificate(
  request: Request,
  organizationId: string,
  companyId: string,
) {
  try {
    if (!isCertUploadApiEnabled()) {
      return notFoundWhenApiOff();
    }
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId, {
      requireOrgAdnSyncEnabled: false,
    });
    if (!gate.ok) {
      return gate.response;
    }
    const canUpload = canOrgAdminMutate(gate.ctx);
    const [row] = await gate.ctx.db
      .select({
        status: companyCertificates.status,
        notAfter: companyCertificates.notAfter,
      })
      .from(companyCertificates)
      .where(
        and(
          eq(companyCertificates.companyId, companyId),
          eq(companyCertificates.organizationId, organizationId),
        ),
      )
      .limit(1);

    const body = {
      status: row?.status ?? null,
      notAfter: row?.notAfter ? formatDateOnlyUtc(row.notAfter) : null,
      capabilities: { canUpload },
    };
    const parsed = companyCertificateGetResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Resposta interna inválida." }, { status: 500 });
    }
    const res = NextResponse.json(parsed.data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePostCompanyCertificate(
  request: Request,
  organizationId: string,
  companyId: string,
) {
  const maxBytes = getCertUploadMaxBytes();
  const maxMb = Math.round(maxBytes / (1024 * 1024));

  try {
    if (!isCertUploadApiEnabled()) {
      return notFoundWhenApiOff();
    }
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId, {
      requireOrgAdnSyncEnabled: false,
    });
    if (!gate.ok) {
      return gate.response;
    }
    if (!canOrgAdminMutate(gate.ctx)) {
      return forbiddenCertRegistration();
    }

    const ct = request.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return jsonCertError(415, "CERT_UPLOAD_EXPECT_MULTIPART");
    }

    const form = await request.formData();
    const file = form.get("file");
    const passwordRaw = form.get("password");
    const password = typeof passwordRaw === "string" ? passwordRaw : "";

    if (!(file instanceof File)) {
      return jsonCertError(400, "CERT_UPLOAD_INVALID_FILE");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) {
      return jsonCertError(400, "CERT_UPLOAD_INVALID_FILE");
    }
    if (buf.length > maxBytes) {
      return jsonCertError(413, "CERT_UPLOAD_FILE_TOO_LARGE", maxMb);
    }

    const cnpj = await loadCompanyCnpjDigits(gate.ctx);
    if ("error" in cnpj) {
      return cnpj.error;
    }

    const validated = validatePkcs12ForCompany(cnpj.cnpjDigits, buf, password);
    if (!validated.ok) {
      await gate.ctx.db.insert(companyCertificateAudits).values({
        organizationId,
        companyId,
        eventType: "upload",
        actorUserId: gate.ctx.session.user.id,
        outcome: "failure",
        errorCode: validated.code,
      });
      const status =
        validated.code === "CERT_UPLOAD_FILE_TOO_LARGE"
          ? 413
          : validated.code === "CERT_UPLOAD_RATE_LIMITED"
            ? 429
            : 400;
      return jsonCertError(status, validated.code, maxMb);
    }

    const lim = await consumeCertUploadRateLimitAsync(
      gate.ctx.session.user.id,
      organizationId,
      companyId,
    );
    if (!lim.ok) {
      console.info(
        JSON.stringify({
          scope: "rate_limit_429",
          route: "cert_upload_post",
          organizationId,
          companyId,
          userId: gate.ctx.session.user.id,
          retryAfterSec: lim.retryAfterSec,
        }),
      );
      const res = jsonCertError(429, "CERT_UPLOAD_RATE_LIMITED");
      res.headers.set("Retry-After", String(lim.retryAfterSec));
      return res;
    }

    let vaultRef: string;
    try {
      const w = await writeCertificateToVault({
        organizationId,
        companyId,
        bytes: buf,
        password,
      });
      vaultRef = w.vaultRef;
    } catch (e) {
      console.error("cert_upload.store_failed", {
        organization_id: organizationId,
        company_id: companyId,
        error: e instanceof Error ? e.message : String(e),
      });
      await gate.ctx.db.insert(companyCertificateAudits).values({
        organizationId,
        companyId,
        eventType: "upload",
        actorUserId: gate.ctx.session.user.id,
        outcome: "failure",
        errorCode: "CERT_UPLOAD_STORE_FAILED",
      });
      return jsonCertError(503, "CERT_UPLOAD_STORE_FAILED");
    }

    const [existing] = await gate.ctx.db
      .select({ vaultRef: companyCertificates.vaultRef })
      .from(companyCertificates)
      .where(eq(companyCertificates.companyId, companyId))
      .limit(1);

    const notAfterStr = formatDateOnlyUtc(validated.notAfter);

    try {
      await gate.ctx.db
        .insert(companyCertificates)
        .values({
          organizationId,
          companyId,
          status: "active",
          notAfter: notAfterStr,
          vaultRef,
          updatedByUserId: gate.ctx.session.user.id,
        })
        .onConflictDoUpdate({
          target: companyCertificates.companyId,
          set: {
            organizationId,
            status: "active",
            notAfter: notAfterStr,
            vaultRef,
            updatedAt: new Date(),
            updatedByUserId: gate.ctx.session.user.id,
          },
        });
    } catch {
      await deleteCertificateVaultObject(vaultRef).catch(() => undefined);
      await gate.ctx.db.insert(companyCertificateAudits).values({
        organizationId,
        companyId,
        eventType: "upload",
        actorUserId: gate.ctx.session.user.id,
        outcome: "failure",
        errorCode: "CERT_UPLOAD_STORE_FAILED",
      });
      return jsonCertError(503, "CERT_UPLOAD_STORE_FAILED");
    }

    if (existing?.vaultRef && existing.vaultRef !== vaultRef) {
      await deleteCertificateVaultObject(existing.vaultRef).catch(() => undefined);
    }

    await gate.ctx.db.insert(companyCertificateAudits).values({
      organizationId,
      companyId,
      eventType: "upload",
      actorUserId: gate.ctx.session.user.id,
      outcome: "success",
      errorCode: null,
    });

    console.info("cert_upload.succeeded", {
      organization_id: organizationId,
      company_id: companyId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handleDeleteCompanyCertificate(
  request: Request,
  organizationId: string,
  companyId: string,
) {
  try {
    if (!isCertUploadApiEnabled()) {
      return notFoundWhenApiOff();
    }
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId, {
      requireOrgAdnSyncEnabled: false,
    });
    if (!gate.ok) {
      return gate.response;
    }
    if (!canOrgAdminMutate(gate.ctx)) {
      return forbiddenCertRegistration();
    }

    const [row] = await gate.ctx.db
      .select({
        status: companyCertificates.status,
        vaultRef: companyCertificates.vaultRef,
      })
      .from(companyCertificates)
      .where(
        and(
          eq(companyCertificates.companyId, companyId),
          eq(companyCertificates.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!row || row.status === "revoked") {
      return new NextResponse(null, { status: 204 });
    }

    await deleteCertificateVaultObject(row.vaultRef).catch(() => undefined);

    await gate.ctx.db
      .update(companyCertificates)
      .set({
        status: "revoked",
        vaultRef: "revoked",
        updatedAt: new Date(),
        updatedByUserId: gate.ctx.session.user.id,
      })
      .where(
        and(
          eq(companyCertificates.companyId, companyId),
          eq(companyCertificates.organizationId, organizationId),
        ),
      );

    await gate.ctx.db.insert(companyCertificateAudits).values({
      organizationId,
      companyId,
      eventType: "revoke",
      actorUserId: gate.ctx.session.user.id,
      outcome: "success",
      errorCode: null,
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

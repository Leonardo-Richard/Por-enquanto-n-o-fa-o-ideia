import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies } from "@repo/db";
import { adnCertificateReadinessResponseSchema } from "@/lib/adn-certificate-readiness-schema";
import {
  buildGetCertificateReadinessPayload,
  runVerifyAndBuildCertificateReadinessPayload,
} from "@/lib/adn-certificate-readiness-logic";
import {
  adnCertVerifyRateKey,
  consumeAdnRateLimit,
  getAdnCertVerifyLimit,
} from "@/lib/adn-rate-limit";
import { toPublicApiError } from "@/server/api/v1/lib/errors";
import { assertAdnOrgAdmin, resolveAdnPublicAccess, type AdnAccessContext } from "./adn-public-access";

function canUserPostVerify(ctx: AdnAccessContext): boolean {
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

function jsonReadiness(body: unknown): NextResponse {
  const parsed = adnCertificateReadinessResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Resposta interna inválida." }, { status: 500 });
  }
  const res = NextResponse.json(parsed.data);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function handleGetAdnCertificateReadiness(
  request: Request,
  organizationId: string,
  companyId: string,
) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const canVerify = canUserPostVerify(gate.ctx);
    const payload = buildGetCertificateReadinessPayload(organizationId, companyId, canVerify);
    console.info("cert_readiness.get", {
      organization_id: organizationId,
      company_id: companyId,
      readiness: payload.certificateReadiness,
    });
    return jsonReadiness(payload);
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePostAdnCertificateReadinessVerify(
  request: Request,
  organizationId: string,
  companyId: string,
  fetchFn: typeof fetch = fetch,
) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const adminBlock = assertAdnOrgAdmin(gate.ctx);
    if (adminBlock) {
      return adminBlock;
    }

    const lim = getAdnCertVerifyLimit();
    const rl = consumeAdnRateLimit({
      key: adnCertVerifyRateKey(gate.ctx.session.user.id, organizationId, companyId),
      max: lim.max,
      windowMs: lim.windowMs,
    });
    if (!rl.ok) {
      const res = NextResponse.json(
        {
          message:
            "Limite de verificações de certificado excedido. Aguarde antes de voltar a tentar.",
          error_code: "ADN_RATE_LIMIT",
          retryAfterSeconds: rl.retryAfterSec,
        },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(rl.retryAfterSec));
      return res;
    }

    const cnpj = await loadCompanyCnpjDigits(gate.ctx);
    if ("error" in cnpj) {
      return cnpj.error;
    }

    const canVerify = true;
    const payload = await runVerifyAndBuildCertificateReadinessPayload(
      organizationId,
      companyId,
      cnpj.cnpjDigits,
      canVerify,
      new Date(),
      fetchFn,
    );

    console.info("cert_readiness.verify", {
      organization_id: organizationId,
      company_id: companyId,
      readiness: payload.certificateReadiness,
    });

    return jsonReadiness(payload);
  } catch (e) {
    return toPublicApiError(e);
  }
}

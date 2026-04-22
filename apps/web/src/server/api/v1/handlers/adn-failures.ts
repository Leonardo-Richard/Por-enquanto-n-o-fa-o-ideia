import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adnIngestionFailures } from "@repo/db";
import { adnJsonFromZodError } from "@/lib/adn-zod-response";
import { toPublicApiError } from "../lib/errors";
import { assertAdnOrgAdmin, resolveAdnPublicAccess } from "./adn-public-access";

const userMessagePt: Record<string, string> = {
  ADN_RATE_LIMIT: "Serviço nacional ocupado. Tente novamente dentro de instantes.",
  STORAGE_COMMIT_FAILED: "Falha ao guardar o documento. Tente reprocessar.",
  ADN_INVALID_BULK_RETRY: "Pedido de reprocessamento em lote inválido.",
};

function mapUserMessage(code: string): string {
  return userMessagePt[code] ?? "Ocorreu um erro ao processar o pedido ADN.";
}

export async function handleGetAdnFailures(request: Request, organizationId: string, companyId: string) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const { db } = gate.ctx;

    const rows = await db
      .select()
      .from(adnIngestionFailures)
      .where(
        and(
          eq(adnIngestionFailures.organizationId, organizationId),
          eq(adnIngestionFailures.companyId, companyId),
          isNull(adnIngestionFailures.resolvedAt),
        ),
      )
      .orderBy(desc(adnIngestionFailures.attemptedAt))
      .limit(100);

    const items = rows.map((r) => ({
      id: r.id,
      attemptedAt: r.attemptedAt,
      errorCode: r.errorCode,
      userMessage: mapUserMessage(r.errorCode),
      canRetry: r.canRetry,
      kind: r.kind,
    }));

    const res = NextResponse.json({ items });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

const bulkSchema = z
  .object({
    failureIds: z.array(z.string().uuid()).min(1).max(50),
  })
  .strict();

export async function handlePostAdnFailuresRetryBulk(
  request: Request,
  organizationId: string,
  companyId: string,
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

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { message: "JSON inválido.", error_code: "ADN_INVALID_JSON" },
        { status: 400 },
      );
    }

    const parsed = bulkSchema.safeParse(json);
    if (!parsed.success) {
      return adnJsonFromZodError(400, "Payload inválido.", "ADN_INVALID_BULK_RETRY", parsed.error);
    }
    const { failureIds } = parsed.data;
    const uniq = new Set(failureIds);
    if (uniq.size !== failureIds.length) {
      return NextResponse.json(
        { message: "IDs duplicados.", error_code: "ADN_INVALID_BULK_RETRY" },
        { status: 400 },
      );
    }

    // MVP: reenfileira um job genérico por lote (sem linha a linha até worker completo).
    return NextResponse.json(
      {
        message: "Reprocessamento em lote aceite (MVP — worker ainda deve consumir fila).",
        accepted: failureIds.length,
      },
      { status: 202 },
    );
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePostAdnFailureRetry(
  request: Request,
  organizationId: string,
  companyId: string,
  failureId: string,
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
    if (!z.string().uuid().safeParse(failureId).success) {
      return NextResponse.json(
        { message: "Identificador inválido.", error_code: "ADN_INVALID_FAILURE_ID" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Reprocessamento pedido (MVP — integração worker pendente)." },
      { status: 202 },
    );
  } catch (e) {
    return toPublicApiError(e);
  }
}

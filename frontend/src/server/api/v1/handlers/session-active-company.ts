import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies, session as sessionTable } from "@repo/db";
import { activeCompanyBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { canAccessCompanyByOrgOrCompanyMembership } from "../lib/effective-company-role";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";

export async function handlePostSessionActiveCompany(request: Request) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = activeCompanyBodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "Identificador de empresa inválido.");
    }

    const { companyId } = parsed.data;
    const db = getDb();
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const superadmin = isSuperadmin(session.user);
    const allowed = await canAccessCompanyByOrgOrCompanyMembership(
      db,
      session.user.id,
      companyId,
      superadmin,
    );
    if (!allowed) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    await db
      .update(sessionTable)
      .set({
        activeCompanyId: companyId,
        activeOrganizationId: company.organizationId,
        updatedAt: new Date(),
      })
      .where(eq(sessionTable.id, session.session.id));

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      companyId,
      organizationId: company.organizationId,
      eventType: "active_company_set",
      metadata: { companyId, organizationId: company.organizationId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toPublicApiError(e);
  }
}

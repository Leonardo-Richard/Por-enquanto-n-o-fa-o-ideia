import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies, companyMemberships, session as sessionTable } from "@repo/db";
import { activeCompanyBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";

async function canAccessCompany(userId: string, companyId: string, superadmin: boolean) {
  if (superadmin) {
    return true;
  }
  const db = getDb();
  const [row] = await db
    .select({ one: companyMemberships.id })
    .from(companyMemberships)
    .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, userId)))
    .limit(1);
  return Boolean(row);
}

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
    const allowed = await canAccessCompany(session.user.id, companyId, superadmin);
    if (!allowed) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    await db
      .update(sessionTable)
      .set({ activeCompanyId: companyId, updatedAt: new Date() })
      .where(eq(sessionTable.id, session.session.id));

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      companyId,
      eventType: "active_company_set",
      metadata: { companyId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toPublicApiError(e);
  }
}

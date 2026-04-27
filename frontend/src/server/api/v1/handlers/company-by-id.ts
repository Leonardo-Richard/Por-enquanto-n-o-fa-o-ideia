import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies } from "@repo/db";
import { companyPatchBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { canListCompany, canMutateCompanyBusinessData, isSuperadmin } from "@/lib/authz";
import { loadEffectiveCompanyRole } from "../lib/effective-company-role";
import { jsonError, toPublicApiError } from "../lib/errors";
import { rowToCompany } from "../lib/company-mapper";
import { getAuthedSession } from "../lib/session";
import { getEffectiveOrganizationId } from "../lib/active-org";

export async function handleGetCompanyById(request: Request, companyId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const db = getDb();
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const eff = await getEffectiveOrganizationId(db, session);
    if (!isSuperadmin(session.user) && eff !== company.organizationId) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const role = await loadEffectiveCompanyRole(db, session.user.id, companyId);
    const hasMembership = role !== null;
    if (!canListCompany(session.user, hasMembership)) {
      return jsonError(404, "Empresa não encontrada.");
    }

    return NextResponse.json({ company: rowToCompany(company) });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePatchCompanyById(request: Request, companyId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const db = getDb();
    const role = await loadEffectiveCompanyRole(db, session.user.id, companyId);
    if (!canMutateCompanyBusinessData(role)) {
      if (isSuperadmin(session.user) && !role) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = companyPatchBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return jsonError(400, "Nenhum campo para atualizar.");
    }

    const [existing] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!existing) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const eff = await getEffectiveOrganizationId(db, session);
    if (!isSuperadmin(session.user) && eff !== existing.organizationId) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const [updated] = await db
      .update(companies)
      .set({
        ...(patch.tradeName !== undefined ? { tradeName: patch.tradeName } : {}),
        ...(patch.systemCode !== undefined ? { systemCode: patch.systemCode } : {}),
        ...(patch.monthlyRunDay !== undefined ? { monthlyRunDay: patch.monthlyRunDay } : {}),
      })
      .where(eq(companies.id, companyId))
      .returning();

    if (!updated) {
      return jsonError(404, "Empresa não encontrada.");
    }

    return NextResponse.json({ company: rowToCompany(updated) });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handleDeleteCompanyById(request: Request, companyId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const db = getDb();
    const role = await loadEffectiveCompanyRole(db, session.user.id, companyId);
    if (!canMutateCompanyBusinessData(role)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const [existing] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!existing) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const eff = await getEffectiveOrganizationId(db, session);
    if (!isSuperadmin(session.user) && eff !== existing.organizationId) {
      return jsonError(404, "Empresa não encontrada.");
    }

    await db.delete(companies).where(eq(companies.id, companyId));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

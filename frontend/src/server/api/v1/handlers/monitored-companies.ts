import { and, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies, organizations } from "@repo/db";
import { clampMonthlyRunDay, companiesAccessibleQuerySchema, companyCreateBodySchema, maskCnpjDigits } from "@repo/shared";
import { getDb } from "@/lib/db";
import { canMutateCompanyBusinessData, isSuperadmin } from "@/lib/authz";
import { jsonError, toPublicApiError } from "../lib/errors";
import { rowToCompany } from "../lib/company-mapper";
import { getAuthedSession } from "../lib/session";
import {
  callerRoleInOrganization,
  canAccessOrganization,
  getEffectiveOrganizationId,
} from "../lib/active-org";
import { createMonitoredCompany } from "../lib/create-monitored-company";

export async function handleGetMonitoredCompanies(request: Request, organizationId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const db = getDb();
    const eff = await getEffectiveOrganizationId(db, session);
    const superadmin = isSuperadmin(session.user);

    if (!superadmin) {
      if (!eff || organizationId !== eff) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
      const ok = await canAccessOrganization(db, session.user.id, organizationId, false);
      if (!ok) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      return jsonError(404, "Organização não encontrada.");
    }

    const url = new URL(request.url);
    const parsed = companiesAccessibleQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return jsonError(400, "Parâmetros de paginação inválidos.");
    }
    const { page, pageSize, q } = parsed.data;
    const offset = (page - 1) * pageSize;

    const searchCond = q?.trim()
      ? or(
          ilike(companies.tradeName, `%${q.trim()}%`),
          ilike(companies.cnpjDigits, `%${q.trim()}%`),
          ilike(companies.systemCode, `%${q.trim()}%`),
        )
      : undefined;

    const whereExpr = searchCond
      ? and(eq(companies.organizationId, organizationId), searchCond)
      : eq(companies.organizationId, organizationId);
    const rows = await db.select().from(companies).where(whereExpr).limit(pageSize).offset(offset);

    const activeCompanyId = (session.session as { activeCompanyId?: string | null }).activeCompanyId ?? null;

    const items = rows.map((c) => ({
      ...rowToCompany(c),
      cnpjMasked: maskCnpjDigits(c.cnpjDigits),
      active: activeCompanyId === c.id,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePostMonitoredCompanies(request: Request, organizationId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const db = getDb();
    const eff = await getEffectiveOrganizationId(db, session);
    const superadmin = isSuperadmin(session.user);

    if (!superadmin) {
      if (!eff || organizationId !== eff) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
    }

    const role = await callerRoleInOrganization(db, session.user.id, organizationId);
    if (!canMutateCompanyBusinessData(role)) {
      if (superadmin && !role) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      return jsonError(404, "Organização não encontrada.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = companyCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const { cnpjDigits, tradeName, systemCode, monthlyRunDay } = parsed.data;
    const day = clampMonthlyRunDay(monthlyRunDay ?? 1);

    try {
      const created = await createMonitoredCompany(db, session, {
        organizationId,
        cnpjDigits,
        tradeName,
        systemCode,
        monthlyRunDay: day,
      });
      return NextResponse.json({ company: rowToCompany(created) }, { status: 201 });
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        return jsonError(409, "CNPJ ou código já registado nesta organização.");
      }
      if (e instanceof Error && e.message === "insert_company_failed") {
        return jsonError(500, "Não foi possível criar a empresa.");
      }
      return toPublicApiError(e);
    }
  } catch (e) {
    return toPublicApiError(e);
  }
}

function isPgUniqueViolation(e: unknown): boolean {
  if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505") {
    return true;
  }
  const cause = e && typeof e === "object" && "cause" in e ? (e as { cause?: { code?: string } }).cause : undefined;
  return cause?.code === "23505";
}

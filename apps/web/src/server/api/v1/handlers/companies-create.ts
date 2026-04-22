import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { organizationMemberships, organizations, session as sessionTable } from "@repo/db";
import { clampMonthlyRunDay, companyCreateBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { canMutateCompanyBusinessData, isSuperadmin } from "@/lib/authz";
import { jsonError, toPublicApiError } from "../lib/errors";
import { rowToCompany } from "../lib/company-mapper";
import { getAuthedSession } from "../lib/session";
import { callerRoleInOrganization, getEffectiveOrganizationId } from "../lib/active-org";
import { createMonitoredCompany } from "../lib/create-monitored-company";

function isPgUniqueViolation(e: unknown): boolean {
  if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505") {
    return true;
  }
  const cause = e && typeof e === "object" && "cause" in e ? (e as { cause?: { code?: string } }).cause : undefined;
  return cause?.code === "23505";
}

export async function handlePostCompanies(request: Request) {
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

    const parsed = companyCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const { cnpjDigits, tradeName, systemCode, monthlyRunDay } = parsed.data;
    const day = clampMonthlyRunDay(monthlyRunDay ?? 1);
    const db = getDb();

    let orgId = await getEffectiveOrganizationId(db, session);

    if (!orgId) {
      const [org] = await db
        .insert(organizations)
        .values({
          name: `Organização de ${session.user.name?.trim() || session.user.email}`,
          active: true,
        })
        .returning();
      if (!org) {
        return jsonError(500, "Não foi possível criar a organização.");
      }
      orgId = org.id;
      await db.insert(organizationMemberships).values({
        organizationId: orgId,
        userId: session.user.id,
        orgRole: "admin",
      });
      await db
        .update(sessionTable)
        .set({ activeOrganizationId: orgId, updatedAt: new Date() })
        .where(eq(sessionTable.id, session.session.id));
    } else {
      const role = await callerRoleInOrganization(db, session.user.id, orgId);
      if (!canMutateCompanyBusinessData(role)) {
        if (isSuperadmin(session.user) && !role) {
          return jsonError(403, "Não tem permissão para esta operação.");
        }
        return jsonError(403, "Não tem permissão para esta operação.");
      }
    }

    try {
      const created = await createMonitoredCompany(db, session, {
        organizationId: orgId,
        cnpjDigits,
        tradeName,
        systemCode,
        monthlyRunDay: day,
      });
      return NextResponse.json({ company: rowToCompany(created) }, { status: 201 });
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        return jsonError(409, "CNPJ ou código já registado.");
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

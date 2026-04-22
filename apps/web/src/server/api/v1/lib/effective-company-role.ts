import { and, eq } from "drizzle-orm";
import { companies, companyMemberships, organizationMemberships } from "@repo/db";
import type { Db } from "@repo/db";

function strongerRole(
  a: "user" | "admin" | null,
  b: "user" | "admin" | null,
): "user" | "admin" | null {
  if (a === "admin" || b === "admin") return "admin";
  if (a === "user" || b === "user") return "user";
  return null;
}

/**
 * Papel efectivo na empresa: membresia directa na empresa ou na organização dona (ORG-09).
 * `company_memberships` continua a existir para dados de vínculo; a decisão de acesso
 * considera o mais permissivo entre empresa e org.
 */
export async function loadEffectiveCompanyRole(
  db: Db,
  userId: string,
  companyId: string,
): Promise<"user" | "admin" | null> {
  const [company] = await db
    .select({ organizationId: companies.organizationId })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) {
    return null;
  }

  const [cm] = await db
    .select({ role: companyMemberships.companyRole })
    .from(companyMemberships)
    .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, userId)))
    .limit(1);
  const companyRole = cm?.role ?? null;

  const [om] = await db
    .select({ orgRole: organizationMemberships.orgRole })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, company.organizationId),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .limit(1);
  const orgRole = om?.orgRole === "admin" || om?.orgRole === "user" ? om.orgRole : null;

  return strongerRole(companyRole, orgRole);
}

export async function canAccessCompanyByOrgOrCompanyMembership(
  db: Db,
  userId: string,
  companyId: string,
  superadmin: boolean,
): Promise<boolean> {
  if (superadmin) return true;
  const role = await loadEffectiveCompanyRole(db, userId, companyId);
  return role !== null;
}

import { and, eq } from "drizzle-orm";
import type { Db } from "@repo/db";
import { organizationMemberships } from "@repo/db";

/**
 * Indica se existe pelo menos um administrador local (membership na organização com `org_role = admin`).
 * Usado pelo handler `POST /organizations` e pelos testes de integração (SORG-06 / AC10–AC11).
 */
export async function hasOrganizationLocalAdmin(db: Db, organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.orgRole, "admin"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

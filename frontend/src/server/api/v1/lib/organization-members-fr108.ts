import { and, count, eq } from "drizzle-orm";
import type { Db } from "@repo/db";
import { organizationMemberships } from "@repo/db";

/** Conta membros com papel de administrador na organização (FR108). */
export async function countOrganizationAdmins(db: Db, organizationId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(organizationMemberships)
    .where(
      and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.orgRole, "admin")),
    );
  return Number(row?.c ?? 0);
}

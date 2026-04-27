import { and, eq } from "drizzle-orm";
import { companies, organizationMemberships } from "@repo/db";
import type { Db } from "@repo/db";
import type { AuthedSession } from "./session";

export async function getEffectiveOrganizationId(db: Db, authed: AuthedSession): Promise<string | null> {
  const s = authed.session as {
    activeOrganizationId?: string | null;
    activeCompanyId?: string | null;
  };
  if (s.activeOrganizationId) {
    return s.activeOrganizationId;
  }
  if (!s.activeCompanyId) {
    return null;
  }
  const [row] = await db
    .select({ oid: companies.organizationId })
    .from(companies)
    .where(eq(companies.id, s.activeCompanyId))
    .limit(1);
  return row?.oid ?? null;
}

export async function callerRoleInOrganization(
  db: Db,
  actorId: string,
  organizationId: string,
): Promise<"user" | "admin" | null> {
  const [row] = await db
    .select({ role: organizationMemberships.orgRole })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, actorId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

export async function canAccessOrganization(
  db: Db,
  userId: string,
  organizationId: string,
  superadmin: boolean,
): Promise<boolean> {
  if (superadmin) {
    return true;
  }
  const [row] = await db
    .select({ one: organizationMemberships.id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

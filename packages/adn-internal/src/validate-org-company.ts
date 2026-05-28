import { and, eq } from "drizzle-orm";
import { companies, organizations } from "@repo/db";
import type { Db } from "@repo/db";
import type { AdnHandlerResult } from "./types.js";

/** Revalida org com ADN activo e empresa pertencente à org (prepare + commit). */
export async function assertOrgCompanyAdnEnabled(
  db: Db,
  organizationId: string,
  companyId: string,
): Promise<AdnHandlerResult<{ organizationId: string; companyId: string }>> {
  const [org] = await db
    .select({ id: organizations.id, adnSyncEnabled: organizations.adnSyncEnabled })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) {
    return { ok: false, error: { status: 403, message: "Operação não permitida." } };
  }
  if (!org.adnSyncEnabled) {
    return {
      ok: false,
      error: {
        status: 403,
        message: "Sincronização ADN desactivada para esta organização.",
        error_code: "ADN_SYNC_DISABLED",
      },
    };
  }

  const [co] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
    .limit(1);
  if (!co) {
    return { ok: false, error: { status: 403, message: "Operação não permitida." } };
  }

  return { ok: true, data: { organizationId, companyId } };
}

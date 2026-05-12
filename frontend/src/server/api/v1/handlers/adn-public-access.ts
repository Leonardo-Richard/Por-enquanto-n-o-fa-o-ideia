import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies, organizations } from "@repo/db";
import type { Db } from "@repo/db";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { canAccessCompanyByOrgOrCompanyMembership } from "@/server/api/v1/lib/effective-company-role";
import { jsonError } from "@/server/api/v1/lib/errors";
import type { AuthedSession } from "@/server/api/v1/lib/session";
import { getAuthedSession } from "@/server/api/v1/lib/session";
import {
  callerRoleInOrganization,
  canAccessOrganization,
  getEffectiveOrganizationId,
} from "@/server/api/v1/lib/active-org";

export type AdnAccessContext = {
  session: AuthedSession;
  /** Instância Drizzle resolvida no mesmo pedido (evita múltiplos *pools*). */
  db: Db;
  organizationId: string;
  companyId: string;
  superadmin: boolean;
  orgRole: "user" | "admin" | null;
};

/** Contexto ADN ao nível da organização (sem empresa no path). */
export type AdnOrganizationAccessContext = {
  session: AuthedSession;
  db: Db;
  organizationId: string;
  superadmin: boolean;
  orgRole: "user" | "admin" | null;
};

export type ResolveAdnPublicAccessOptions = {
  /**
   * Quando `false`, não exige `organizations.adnSyncEnabled` (ex.: registo de certificado
   * pelo portal com a API de upload activa — por omissão — antes de activar a fila ADN na organização).
   * Default: `true` (comportamento original para sync, artefactos, etc.).
   */
  requireOrgAdnSyncEnabled?: boolean;
};

export async function resolveAdnPublicAccess(
  request: Request,
  organizationId: string,
  companyId: string,
  options?: ResolveAdnPublicAccessOptions,
): Promise<{ ok: true; ctx: AdnAccessContext } | { ok: false; response: NextResponse }> {
  const requireOrgAdnSyncEnabled = options?.requireOrgAdnSyncEnabled !== false;
  const s = await getAuthedSession(request);
  if (!s) {
    return { ok: false, response: jsonError(401, "Sessão expirada. Inicie sessão novamente.") };
  }

  const db = getDb();
  const superadmin = isSuperadmin(s.user);

  if (!superadmin) {
    const eff = await getEffectiveOrganizationId(db, s);
    if (!eff || eff !== organizationId) {
      return { ok: false, response: jsonError(403, "Não tem permissão para esta operação.") };
    }
    const okOrg = await canAccessOrganization(db, s.user.id, organizationId, false);
    if (!okOrg) {
      return { ok: false, response: jsonError(403, "Não tem permissão para esta operação.") };
    }
  } else {
    const okOrg = await canAccessOrganization(db, s.user.id, organizationId, true);
    if (!okOrg) {
      return { ok: false, response: jsonError(404, "Recurso não encontrado.") };
    }
  }

  const [org] = await db
    .select({ id: organizations.id, adnSyncEnabled: organizations.adnSyncEnabled })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) {
    return { ok: false, response: jsonError(404, "Recurso não encontrado.") };
  }
  if (requireOrgAdnSyncEnabled && !org.adnSyncEnabled) {
    return { ok: false, response: jsonError(404, "Recurso não encontrado.") };
  }

  const [company] = await db
    .select({ id: companies.id, organizationId: companies.organizationId })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
    .limit(1);
  if (!company) {
    return { ok: false, response: jsonError(404, "Recurso não encontrado.") };
  }

  const canCo = await canAccessCompanyByOrgOrCompanyMembership(db, s.user.id, companyId, superadmin);
  if (!canCo) {
    return { ok: false, response: jsonError(403, "Não tem permissão para esta operação.") };
  }

  const orgRole = await callerRoleInOrganization(db, s.user.id, organizationId);

  return {
    ok: true,
    ctx: { session: s, db, organizationId, companyId, superadmin, orgRole },
  };
}

/**
 * Mesmo gate FR45 que rotas ADN públicas, sem validar empresa — para listagens ao nível da org (execuções).
 */
export async function resolveAdnOrganizationPublicAccess(
  request: Request,
  organizationId: string,
  options?: ResolveAdnPublicAccessOptions,
): Promise<
  { ok: true; ctx: AdnOrganizationAccessContext } | { ok: false; response: NextResponse }
> {
  const requireOrgAdnSyncEnabled = options?.requireOrgAdnSyncEnabled !== false;
  const s = await getAuthedSession(request);
  if (!s) {
    return { ok: false, response: jsonError(401, "Sessão expirada. Inicie sessão novamente.") };
  }

  const db = getDb();
  const superadmin = isSuperadmin(s.user);

  if (!superadmin) {
    const eff = await getEffectiveOrganizationId(db, s);
    if (!eff || eff !== organizationId) {
      return { ok: false, response: jsonError(403, "Não tem permissão para esta operação.") };
    }
    const okOrg = await canAccessOrganization(db, s.user.id, organizationId, false);
    if (!okOrg) {
      return { ok: false, response: jsonError(403, "Não tem permissão para esta operação.") };
    }
  } else {
    const okOrg = await canAccessOrganization(db, s.user.id, organizationId, true);
    if (!okOrg) {
      return { ok: false, response: jsonError(404, "Recurso não encontrado.") };
    }
  }

  const [org] = await db
    .select({ id: organizations.id, adnSyncEnabled: organizations.adnSyncEnabled })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) {
    return { ok: false, response: jsonError(404, "Recurso não encontrado.") };
  }
  if (requireOrgAdnSyncEnabled && !org.adnSyncEnabled) {
    return { ok: false, response: jsonError(404, "Recurso não encontrado.") };
  }

  const orgRole = await callerRoleInOrganization(db, s.user.id, organizationId);

  return {
    ok: true,
    ctx: { session: s, db, organizationId, superadmin, orgRole },
  };
}

export function assertAdnOrgAdmin(ctx: AdnAccessContext): NextResponse | null {
  if (ctx.superadmin && ctx.orgRole !== "admin") {
    return jsonError(403, "Não tem permissão para esta operação.");
  }
  if (!ctx.superadmin && ctx.orgRole !== "admin") {
    return jsonError(403, "Não tem permissão para esta operação.");
  }
  return null;
}

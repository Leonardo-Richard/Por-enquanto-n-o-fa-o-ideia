import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { organizations } from "@repo/db";
import { getDb } from "@/lib/db";
import { canManageUsers, isSuperadmin } from "@/lib/authz";
import { jsonError, toPublicApiError } from "@/server/api/v1/lib/errors";
import { getAuthedSession } from "@/server/api/v1/lib/session";
import {
  callerRoleInOrganization,
  canAccessOrganization,
  getEffectiveOrganizationId,
} from "@/server/api/v1/lib/active-org";

const patchBodySchema = z
  .object({
    adnSyncEnabled: z.boolean(),
  })
  .strict();

export async function handleGetOrganizationAdnSyncSettings(request: Request, organizationId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const db = getDb();
    const superadmin = isSuperadmin(session.user);

    if (!superadmin) {
      const eff = await getEffectiveOrganizationId(db, session);
      if (!eff || eff !== organizationId) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
      const okOrg = await canAccessOrganization(db, session.user.id, organizationId, false);
      if (!okOrg) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
    } else {
      const okOrg = await canAccessOrganization(db, session.user.id, organizationId, true);
      if (!okOrg) {
        return jsonError(404, "Organização não encontrada.");
      }
    }

    const [org] = await db
      .select({ id: organizations.id, adnSyncEnabled: organizations.adnSyncEnabled })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) {
      return jsonError(404, "Organização não encontrada.");
    }

    const orgRole = await callerRoleInOrganization(db, session.user.id, organizationId);
    const canManage = canManageUsers(session.user, orgRole);

    const res = NextResponse.json({
      adnSyncEnabled: org.adnSyncEnabled,
      canManage,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePatchOrganizationAdnSyncSettings(request: Request, organizationId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const db = getDb();
    const superadmin = isSuperadmin(session.user);

    if (!superadmin) {
      const eff = await getEffectiveOrganizationId(db, session);
      if (!eff || eff !== organizationId) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
      const okOrg = await canAccessOrganization(db, session.user.id, organizationId, false);
      if (!okOrg) {
        return jsonError(403, "Não tem permissão para esta operação.");
      }
    } else {
      const okOrg = await canAccessOrganization(db, session.user.id, organizationId, true);
      if (!okOrg) {
        return jsonError(404, "Organização não encontrada.");
      }
    }

    const orgRole = await callerRoleInOrganization(db, session.user.id, organizationId);
    if (!canManageUsers(session.user, orgRole)) {
      return jsonError(403, "Apenas administradores da organização podem alterar esta definição.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }
    const parsed = patchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "Corpo inválido. Use { \"adnSyncEnabled\": true|false }.");
    }

    const [updated] = await db
      .update(organizations)
      .set({ adnSyncEnabled: parsed.data.adnSyncEnabled })
      .where(eq(organizations.id, organizationId))
      .returning({ adnSyncEnabled: organizations.adnSyncEnabled });

    if (!updated) {
      return jsonError(404, "Organização não encontrada.");
    }

    const res = NextResponse.json({ adnSyncEnabled: updated.adnSyncEnabled });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { organizations } from "@repo/db";
import { insertAuditEvent } from "@/lib/audit";
import {
  auditSuffixPreview,
  normalizeLocalDownloadRootInput,
  validateLocalDownloadRoot,
} from "@/lib/local-download-root";
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
    adnSyncEnabled: z.boolean().optional(),
    localDownloadRoot: z.union([z.string(), z.null()]).optional(),
  })
  .strict()
  .refine((o) => o.adnSyncEnabled !== undefined || o.localDownloadRoot !== undefined, {
    message: "Corpo inválido. Indique adnSyncEnabled e/ou localDownloadRoot.",
  });

function localDownloadRootFromRow(raw: string | null): string | null {
  return normalizeLocalDownloadRootInput(raw);
}

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
      .select({
        id: organizations.id,
        adnSyncEnabled: organizations.adnSyncEnabled,
        localDownloadRoot: organizations.localDownloadRoot,
      })
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
      localDownloadRoot: localDownloadRootFromRow(org.localDownloadRoot),
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
      const msg = parsed.error.flatten().formErrors[0] ?? "Corpo inválido.";
      return jsonError(400, msg);
    }

    let nextLocal: string | null | undefined;
    if (parsed.data.localDownloadRoot !== undefined) {
      const v = validateLocalDownloadRoot(parsed.data.localDownloadRoot);
      if (!v.ok) {
        return NextResponse.json({ message: v.message, error_code: v.code }, { status: 400 });
      }
      nextLocal = v.value;
    }

    const [before] = await db
      .select({
        adnSyncEnabled: organizations.adnSyncEnabled,
        localDownloadRoot: organizations.localDownloadRoot,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!before) {
      return jsonError(404, "Organização não encontrada.");
    }

    const prevNorm = localDownloadRootFromRow(before.localDownloadRoot);
    const pathChanges =
      nextLocal !== undefined && (prevNorm ?? null) !== (nextLocal ?? null);

    const setPayload: {
      adnSyncEnabled?: boolean;
      localDownloadRoot?: string | null;
      updatedAt?: Date;
    } = { updatedAt: new Date() };
    if (parsed.data.adnSyncEnabled !== undefined) {
      setPayload.adnSyncEnabled = parsed.data.adnSyncEnabled;
    }
    if (nextLocal !== undefined) {
      setPayload.localDownloadRoot = nextLocal;
    }

    const [updated] = await db
      .update(organizations)
      .set(setPayload)
      .where(eq(organizations.id, organizationId))
      .returning({
        adnSyncEnabled: organizations.adnSyncEnabled,
        localDownloadRoot: organizations.localDownloadRoot,
      });

    if (!updated) {
      return jsonError(404, "Organização não encontrada.");
    }

    if (pathChanges && nextLocal !== undefined) {
      await insertAuditEvent(db, {
        actorUserId: session.user.id,
        organizationId,
        eventType: "organization_local_download_root_updated",
        metadata: {
          previousLength: prevNorm?.length ?? 0,
          newLength: nextLocal?.length ?? 0,
          suffixPreview: nextLocal ? auditSuffixPreview(nextLocal) : "",
        },
      });
    }

    const orgRoleAfter = await callerRoleInOrganization(db, session.user.id, organizationId);
    const canManage = canManageUsers(session.user, orgRoleAfter);

    const res = NextResponse.json({
      adnSyncEnabled: updated.adnSyncEnabled,
      localDownloadRoot: localDownloadRootFromRow(updated.localDownloadRoot),
      canManage,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return toPublicApiError(e);
  }
}

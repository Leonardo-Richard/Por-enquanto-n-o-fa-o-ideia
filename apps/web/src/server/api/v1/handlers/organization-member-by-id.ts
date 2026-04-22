import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { Db } from "@repo/db";
import { organizationMemberships, organizations } from "@repo/db";
import { memberPatchBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { canManageUsers } from "@/lib/authz";
import { wouldViolateLastAdmin } from "@/lib/last-admin";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { callerRoleInOrganization } from "../lib/active-org";

async function callerRoleInOrg(actorId: string, organizationId: string) {
  return callerRoleInOrganization(getDb(), actorId, organizationId);
}

async function countOrgAdmins(db: Db, organizationId: string) {
  const [row] = await db
    .select({ c: count() })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.orgRole, "admin"),
      ),
    );
  return Number(row?.c ?? 0);
}

export async function handlePatchOrganizationMember(
  request: Request,
  organizationId: string,
  targetUserId: string,
) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const role = await callerRoleInOrg(session.user.id, organizationId);
    if (!canManageUsers(session.user, role)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = memberPatchBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return jsonError(400, "Nenhum campo para atualizar.");
    }

    const db = getDb();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      return jsonError(404, "Organização não encontrada.");
    }

    const [membership] = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, targetUserId),
        ),
      )
      .limit(1);
    if (!membership) {
      return jsonError(404, "Membro não encontrado.");
    }

    if (patch.companyRole !== undefined) {
      const adminCount = await countOrgAdmins(db, organizationId);
      const targetIsAdmin = membership.orgRole === "admin";
      if (wouldViolateLastAdmin(adminCount, targetIsAdmin, "demote")) {
        return jsonError(409, "Não é possível remover o último administrador da organização.", {
          code: "last_admin",
        });
      }
    }

    await db
      .update(organizationMemberships)
      .set({
        ...(patch.companyRole !== undefined ? { orgRole: patch.companyRole } : {}),
        ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
        ...(patch.department !== undefined ? { department: patch.department } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, targetUserId),
        ),
      );

    if (patch.companyRole !== undefined) {
      await insertAuditEvent(db, {
        actorUserId: session.user.id,
        targetUserId,
        organizationId,
        eventType: "membership_role_changed",
        metadata: { orgRole: patch.companyRole, scope: "organization" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handleDeleteOrganizationMember(
  request: Request,
  organizationId: string,
  targetUserId: string,
) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const role = await callerRoleInOrg(session.user.id, organizationId);
    if (!canManageUsers(session.user, role)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const db = getDb();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      return jsonError(404, "Organização não encontrada.");
    }

    const [membership] = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, targetUserId),
        ),
      )
      .limit(1);
    if (!membership) {
      return jsonError(404, "Membro não encontrado.");
    }

    const adminCount = await countOrgAdmins(db, organizationId);
    const targetIsAdmin = membership.orgRole === "admin";
    if (wouldViolateLastAdmin(adminCount, targetIsAdmin, "remove")) {
      return jsonError(409, "Não é possível remover o último administrador da organização.", {
        code: "last_admin",
      });
    }

    await db
      .delete(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, targetUserId),
        ),
      );

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      targetUserId,
      organizationId,
      eventType: "membership_removed",
      metadata: { scope: "organization" },
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

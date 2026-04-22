import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { Db } from "@repo/db";
import { companies, companyMemberships } from "@repo/db";
import { memberPatchBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { canManageUsers } from "@/lib/authz";
import { wouldViolateLastAdmin } from "@/lib/last-admin";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";

async function callerRoleInCompany(actorId: string, companyId: string) {
  const db = getDb();
  const [row] = await db
    .select({ role: companyMemberships.companyRole })
    .from(companyMemberships)
    .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, actorId)));
  return row?.role ?? null;
}

async function countAdmins(db: Db, companyId: string) {
  const [row] = await db
    .select({ c: count() })
    .from(companyMemberships)
    .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.companyRole, "admin")));
  return Number(row?.c ?? 0);
}

export async function handlePatchCompanyMember(
  request: Request,
  companyId: string,
  targetUserId: string,
) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const role = await callerRoleInCompany(session.user.id, companyId);
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
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const [membership] = await db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, targetUserId)))
      .limit(1);
    if (!membership) {
      return jsonError(404, "Membro não encontrado.");
    }

    if (patch.companyRole !== undefined) {
      const adminCount = await countAdmins(db, companyId);
      const targetIsAdmin = membership.companyRole === "admin";
      if (wouldViolateLastAdmin(adminCount, targetIsAdmin, "demote")) {
        return jsonError(409, "Não é possível remover o último administrador da empresa.", {
          code: "last_admin",
        });
      }
    }

    await db
      .update(companyMemberships)
      .set({
        ...(patch.companyRole !== undefined ? { companyRole: patch.companyRole } : {}),
        ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
        ...(patch.department !== undefined ? { department: patch.department } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, targetUserId)));

    if (patch.companyRole !== undefined) {
      await insertAuditEvent(db, {
        actorUserId: session.user.id,
        targetUserId,
        companyId,
        eventType: "membership_role_changed",
        metadata: { companyRole: patch.companyRole },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handleDeleteCompanyMember(
  _request: Request,
  companyId: string,
  targetUserId: string,
) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const role = await callerRoleInCompany(session.user.id, companyId);
    if (!canManageUsers(session.user, role)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const db = getDb();
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const [membership] = await db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, targetUserId)))
      .limit(1);
    if (!membership) {
      return jsonError(404, "Membro não encontrado.");
    }

    const adminCount = await countAdmins(db, companyId);
    const targetIsAdmin = membership.companyRole === "admin";
    if (wouldViolateLastAdmin(adminCount, targetIsAdmin, "remove")) {
      return jsonError(409, "Não é possível remover o último administrador da empresa.", {
        code: "last_admin",
      });
    }

    await db
      .delete(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, targetUserId)));

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      targetUserId,
      companyId,
      eventType: "membership_removed",
      metadata: {},
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

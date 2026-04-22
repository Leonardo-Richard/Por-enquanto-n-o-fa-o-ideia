import { memberPatchBodySchema } from "@repo/shared";
import { companies, companyMemberships, user } from "@repo/db";
import { and, count, eq } from "drizzle-orm";
import { getAuthedSession } from "@/app/api/v1/_lib/session";
import { jsonError } from "@/app/api/v1/_lib/http";
import { getDb } from "@/lib/db";
import { canManageUsers, isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";

const LAST_ADMIN_PT =
  "Promova outro utilizador a administrador antes de remover ou rebaixar o último administrador.";

async function countAdmins(
  db: ReturnType<typeof getDb>,
  companyId: string,
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.companyRole, "admin"),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

async function logSuperadminAccessIfNeeded(
  db: ReturnType<typeof getDb>,
  companyId: string,
  actorUserId: string,
  actorIsSuperadmin: boolean,
) {
  if (!actorIsSuperadmin) {
    return;
  }
  const [m] = await db
    .select({ id: companyMemberships.id })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, actorUserId),
      ),
    )
    .limit(1);
  if (m) {
    return;
  }
  await insertAuditEvent(db, {
    actorUserId,
    companyId,
    eventType: "superadmin_access_company",
    metadata: { companyId },
  });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ companyId: string; userId: string }> },
) {
  const { companyId, userId: targetUserId } = await ctx.params;
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const body = await request.json().catch(() => null);
  const parsed = memberPatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "validation_error", "Dados inválidos.", {
      details: parsed.error.flatten(),
    });
  }

  const db = getDb();
  const [urow] = await db
    .select({ isSuperadmin: user.isSuperadmin })
    .from(user)
    .where(eq(user.id, s.user.id))
    .limit(1);
  if (!urow) {
    return jsonError(401, "unauthorized", "Utilizador inválido.");
  }

  const [co] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!co) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  const [mself] = await db
    .select({ companyRole: companyMemberships.companyRole })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, s.user.id),
      ),
    )
    .limit(1);

  if (!canManageUsers(urow, mself?.companyRole ?? null)) {
    return jsonError(403, "forbidden", "Sem permissão para esta ação.");
  }

  const [target] = await db
    .select({
      id: companyMemberships.id,
      companyRole: companyMemberships.companyRole,
    })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, targetUserId),
      ),
    )
    .limit(1);

  if (!target) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  await logSuperadminAccessIfNeeded(
    db,
    companyId,
    s.user.id,
    isSuperadmin(urow),
  );

  const nextRole = parsed.data.companyRole;
  if (nextRole === "user" && target.companyRole === "admin") {
    const admins = await countAdmins(db, companyId);
    if (admins <= 1) {
      return jsonError(409, "last_admin", LAST_ADMIN_PT);
    }
  }

  const updates: {
    companyRole?: "user" | "admin";
    jobTitle?: string | null;
    department?: string | null;
    phone?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (parsed.data.companyRole !== undefined) {
    updates.companyRole = parsed.data.companyRole;
  }
  if (parsed.data.jobTitle !== undefined) {
    updates.jobTitle = parsed.data.jobTitle;
  }
  if (parsed.data.department !== undefined) {
    updates.department = parsed.data.department;
  }
  if (parsed.data.phone !== undefined) {
    updates.phone = parsed.data.phone;
  }

  await db
    .update(companyMemberships)
    .set(updates)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, targetUserId),
      ),
    );

  if (parsed.data.companyRole !== undefined && parsed.data.companyRole !== target.companyRole) {
    await insertAuditEvent(db, {
      actorUserId: s.user.id,
      targetUserId,
      companyId,
      eventType: "membership_role_changed",
      metadata: {
        from: target.companyRole,
        to: parsed.data.companyRole,
      },
    });
  }

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ companyId: string; userId: string }> },
) {
  const { companyId, userId: targetUserId } = await ctx.params;
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const db = getDb();
  const [urow] = await db
    .select({ isSuperadmin: user.isSuperadmin })
    .from(user)
    .where(eq(user.id, s.user.id))
    .limit(1);
  if (!urow) {
    return jsonError(401, "unauthorized", "Utilizador inválido.");
  }

  const [co] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!co) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  const [mself] = await db
    .select({ companyRole: companyMemberships.companyRole })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, s.user.id),
      ),
    )
    .limit(1);

  if (!canManageUsers(urow, mself?.companyRole ?? null)) {
    return jsonError(403, "forbidden", "Sem permissão para esta ação.");
  }

  const [target] = await db
    .select({ companyRole: companyMemberships.companyRole })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, targetUserId),
      ),
    )
    .limit(1);

  if (!target) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  await logSuperadminAccessIfNeeded(
    db,
    companyId,
    s.user.id,
    isSuperadmin(urow),
  );

  if (target.companyRole === "admin") {
    const admins = await countAdmins(db, companyId);
    if (admins <= 1) {
      return jsonError(409, "last_admin", LAST_ADMIN_PT);
    }
  }

  await db
    .delete(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, targetUserId),
      ),
    );

  await insertAuditEvent(db, {
    actorUserId: s.user.id,
    targetUserId,
    companyId,
    eventType: "membership_removed",
    metadata: {},
  });

  return new Response(null, { status: 204 });
}

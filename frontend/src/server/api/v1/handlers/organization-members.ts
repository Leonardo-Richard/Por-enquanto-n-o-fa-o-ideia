import { and, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { organizationMemberships, organizations, user } from "@repo/db";
import { memberPostBodySchema, membersQuerySchema } from "@repo/shared";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageUsers, isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { callerRoleInOrganization } from "../lib/active-org";

async function assertOrgExists(organizationId: string) {
  const db = getDb();
  const [row] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  return Boolean(row);
}

export async function handleGetOrganizationMembers(request: Request, organizationId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const role = await callerRoleInOrganization(getDb(), session.user.id, organizationId);
    if (!canManageUsers(session.user, role)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const url = new URL(request.url);
    const parsed = membersQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return jsonError(400, "Parâmetros inválidos.");
    }
    const { page, pageSize, q } = parsed.data;
    const offset = (page - 1) * pageSize;

    const db = getDb();
    const search =
      q?.trim() &&
      or(ilike(user.email, `%${q.trim()}%`), ilike(user.name, `%${q.trim()}%`));

    const base = db
      .select({
        userId: user.id,
        email: user.email,
        name: user.name,
        companyRole: organizationMemberships.orgRole,
        jobTitle: organizationMemberships.jobTitle,
        department: organizationMemberships.department,
        phone: organizationMemberships.phone,
      })
      .from(organizationMemberships)
      .innerJoin(user, eq(user.id, organizationMemberships.userId))
      .where(
        search
          ? and(eq(organizationMemberships.organizationId, organizationId), search)
          : eq(organizationMemberships.organizationId, organizationId),
      );

    const items = await base.limit(pageSize).offset(offset);
    return NextResponse.json({ items });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePostOrganizationMembers(request: Request, organizationId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const role = await callerRoleInOrganization(getDb(), session.user.id, organizationId);
    if (!canManageUsers(session.user, role)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = memberPostBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const db = getDb();
    if (!(await assertOrgExists(organizationId))) {
      return jsonError(404, "Organização não encontrada.");
    }

    const body = parsed.data;
    const orgRole = body.companyRole ?? "user";

    if (body.mode === "link") {
      const email = body.email.trim().toLowerCase();
      const [target] = await db.select().from(user).where(eq(user.email, email)).limit(1);
      if (!target) {
        return jsonError(404, "Utilizador não encontrado com este email.");
      }
      const [existing] = await db
        .select({ id: organizationMemberships.id })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, target.id),
          ),
        )
        .limit(1);
      if (existing) {
        return jsonError(409, "Utilizador já pertence a esta organização.");
      }
      await db.insert(organizationMemberships).values({
        organizationId,
        userId: target.id,
        orgRole,
      });
      if (isSuperadmin(session.user) && !role) {
        await insertAuditEvent(db, {
          actorUserId: session.user.id,
          targetUserId: target.id,
          organizationId,
          eventType: "superadmin_access_company",
          metadata: { scope: "organization", organizationId },
        });
      }
      await insertAuditEvent(db, {
        actorUserId: session.user.id,
        targetUserId: target.id,
        organizationId,
        eventType: "membership_created",
        metadata: { mode: "link", orgRole, scope: "organization" },
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const email = body.email.trim().toLowerCase();
    const [dup] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (dup) {
      return jsonError(409, "Já existe conta com este email.");
    }

    try {
      await auth.api.signUpEmail({
        body: {
          name: body.name.trim(),
          email,
          password: body.password,
        },
        headers: request.headers,
      });
    } catch (err) {
      return jsonError(
        400,
        err instanceof Error ? err.message : "Não foi possível criar utilizador.",
      );
    }

    const [createdUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (!createdUser) {
      return jsonError(500, "Utilizador criado mas não encontrado na base.");
    }

    await db.insert(organizationMemberships).values({
      organizationId,
      userId: createdUser.id,
      orgRole,
    });

    if (isSuperadmin(session.user) && !role) {
      await insertAuditEvent(db, {
        actorUserId: session.user.id,
        targetUserId: createdUser.id,
        organizationId,
        eventType: "superadmin_access_company",
        metadata: { scope: "organization", organizationId },
      });
    }

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      targetUserId: createdUser.id,
      organizationId,
      eventType: "membership_created",
      metadata: { mode: "create", orgRole, scope: "organization" },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

import { and, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies, companyMemberships, user } from "@repo/db";
import { memberPostBodySchema, membersQuerySchema } from "@repo/shared";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageUsers } from "@/lib/authz";
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

export async function handleGetCompanyMembers(request: Request, companyId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const role = await callerRoleInCompany(session.user.id, companyId);
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
        companyRole: companyMemberships.companyRole,
        jobTitle: companyMemberships.jobTitle,
        department: companyMemberships.department,
        phone: companyMemberships.phone,
      })
      .from(companyMemberships)
      .innerJoin(user, eq(user.id, companyMemberships.userId))
      .where(
        search
          ? and(eq(companyMemberships.companyId, companyId), search)
          : eq(companyMemberships.companyId, companyId),
      );

    const items = await base.limit(pageSize).offset(offset);
    return NextResponse.json({ items });
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePostCompanyMembers(request: Request, companyId: string) {
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

    const parsed = memberPostBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const db = getDb();
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) {
      return jsonError(404, "Empresa não encontrada.");
    }

    const body = parsed.data;
    const companyRole = body.companyRole ?? "user";

    if (body.mode === "link") {
      const email = body.email.trim().toLowerCase();
      const [target] = await db.select().from(user).where(eq(user.email, email)).limit(1);
      if (!target) {
        return jsonError(404, "Utilizador não encontrado com este email.");
      }
      const [existing] = await db
        .select({ id: companyMemberships.id })
        .from(companyMemberships)
        .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, target.id)))
        .limit(1);
      if (existing) {
        return jsonError(409, "Utilizador já pertence a esta empresa.");
      }
      await db.insert(companyMemberships).values({
        companyId,
        userId: target.id,
        companyRole,
      });
      await insertAuditEvent(db, {
        actorUserId: session.user.id,
        targetUserId: target.id,
        companyId,
        eventType: "membership_created",
        metadata: { mode: "link", companyRole },
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

    await db.insert(companyMemberships).values({
      companyId,
      userId: createdUser.id,
      companyRole,
    });

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      targetUserId: createdUser.id,
      companyId,
      eventType: "membership_created",
      metadata: { mode: "create", companyRole },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

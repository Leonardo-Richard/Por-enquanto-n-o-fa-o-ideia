import {
  memberPostBodySchema,
  membersQuerySchema,
} from "@repo/shared";
import {
  account,
  companies,
  companyMemberships,
  user,
} from "@repo/db";
import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getAuthedSession } from "@/app/api/v1/_lib/session";
import { jsonError } from "@/app/api/v1/_lib/http";
import { getDb } from "@/lib/db";
import { canManageUsers, isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { rateLimitMembersSearch } from "@/lib/rate-limit";

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

export async function GET(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const rl = await rateLimitMembersSearch(s.user.id);
  if (!rl.ok) {
    return jsonError(429, "rate_limited", "Demasiados pedidos. Tente mais tarde.");
  }

  const url = new URL(request.url);
  const parsed = membersQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return jsonError(400, "validation_error", "Query inválida.", {
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

  const { q, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;
  const search =
    q && q.trim().length > 0
      ? or(
          ilike(user.email, `%${q.trim()}%`),
          ilike(user.name, `%${q.trim()}%`),
        )
      : undefined;

  const whereList = search
    ? and(eq(companyMemberships.companyId, companyId), search)
    : eq(companyMemberships.companyId, companyId);

  const totalRows = await db
    .select({ n: count() })
    .from(companyMemberships)
    .innerJoin(user, eq(companyMemberships.userId, user.id))
    .where(whereList);
  const total = Number(totalRows[0]?.n ?? 0);

  const rows = await db
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
    .innerJoin(user, eq(companyMemberships.userId, user.id))
    .where(whereList)
    .orderBy(asc(user.name))
    .limit(pageSize)
    .offset(offset);

  return Response.json({
    page,
    pageSize,
    total,
    items: rows,
  });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const body = await request.json().catch(() => null);
  const parsed = memberPostBodySchema.safeParse(body);
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

  await logSuperadminAccessIfNeeded(
    db,
    companyId,
    s.user.id,
    isSuperadmin(urow),
  );

  const role = parsed.data.companyRole ?? "user";

  if (parsed.data.mode === "link") {
    const email = parsed.data.email.toLowerCase();
    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (!target) {
      return jsonError(400, "unknown_email", "E-mail não registado na plataforma.");
    }
    const [dup] = await db
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.userId, target.id),
        ),
      )
      .limit(1);
    if (dup) {
      return jsonError(400, "already_member", "Este utilizador já pertence à empresa.");
    }

    await db.insert(companyMemberships).values({
      companyId,
      userId: target.id,
      companyRole: role,
    });

    await insertAuditEvent(db, {
      actorUserId: s.user.id,
      targetUserId: target.id,
      companyId,
      eventType: "membership_created",
      metadata: { mode: "link", companyRole: role },
    });

    return Response.json({ ok: true }, { status: 201 });
  }

  const email = parsed.data.email.toLowerCase();
  const [exists] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (exists) {
    return jsonError(400, "email_in_use", "Este e-mail já está registado.");
  }

  const userId = randomUUID();
  const accId = randomUUID();
  const hashed = bcrypt.hashSync(parsed.data.password, 10);

  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: parsed.data.name.trim(),
      email,
      emailVerified: false,
      isSuperadmin: false,
    });
    await tx.insert(account).values({
      id: accId,
      accountId: email,
      providerId: "credential",
      userId,
      password: hashed,
    });
    await tx.insert(companyMemberships).values({
      companyId,
      userId,
      companyRole: role,
    });
  });

  await insertAuditEvent(db, {
    actorUserId: s.user.id,
    targetUserId: userId,
    companyId,
    eventType: "membership_created",
    metadata: { mode: "create", companyRole: role },
  });

  return Response.json({ ok: true, userId }, { status: 201 });
}

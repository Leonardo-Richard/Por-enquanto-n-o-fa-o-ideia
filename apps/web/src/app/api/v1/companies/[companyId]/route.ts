import { companyPatchBodySchema, clampMonthlyRunDay } from "@repo/shared";
import { companies, companyMemberships, user } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { getAuthedSession } from "@/app/api/v1/_lib/session";
import { jsonError } from "@/app/api/v1/_lib/http";
import { getDb } from "@/lib/db";
import { canListCompany, canMutateCompanyBusinessData, isSuperadmin } from "@/lib/authz";

async function accessForCompany(
  db: ReturnType<typeof getDb>,
  companyId: string,
  actorId: string,
  actorIsSuperadmin: boolean,
): Promise<{ ok: false } | { ok: true; role: "user" | "admin" | null }> {
  if (actorIsSuperadmin) {
    const [co] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!co) {
      return { ok: false };
    }
    const [m] = await db
      .select({ companyRole: companyMemberships.companyRole })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.userId, actorId),
        ),
      )
      .limit(1);
    return { ok: true, role: m?.companyRole ?? null };
  }

  const [m] = await db
    .select({ companyRole: companyMemberships.companyRole })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, actorId),
      ),
    )
    .limit(1);
  if (!m) {
    return { ok: false };
  }
  return { ok: true, role: m.companyRole };
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
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
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!co) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  const [m] = await db
    .select({ companyRole: companyMemberships.companyRole })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.userId, s.user.id),
      ),
    )
    .limit(1);

  if (!canListCompany(urow, Boolean(m))) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  return Response.json({
    company: {
      id: co.id,
      cnpjDigits: co.cnpjDigits,
      tradeName: co.tradeName,
      systemCode: co.systemCode,
      monthlyRunDay: co.monthlyRunDay,
      createdAt: co.createdAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const body = await request.json().catch(() => null);
  const parsed = companyPatchBodySchema.safeParse(body);
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

  const acc = await accessForCompany(db, companyId, s.user.id, isSuperadmin(urow));
  if (!acc.ok) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  if (!canMutateCompanyBusinessData(acc.role)) {
    return jsonError(403, "forbidden", "Sem permissão para esta ação.");
  }

  const updates: Partial<typeof companies.$inferInsert> = {};
  if (parsed.data.tradeName !== undefined) {
    updates.tradeName = parsed.data.tradeName.trim();
  }
  if (parsed.data.systemCode !== undefined) {
    updates.systemCode = parsed.data.systemCode.trim();
  }
  if (parsed.data.monthlyRunDay !== undefined) {
    updates.monthlyRunDay = clampMonthlyRunDay(parsed.data.monthlyRunDay);
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(400, "validation_error", "Nada para atualizar.");
  }

  const [next] = await db
    .update(companies)
    .set(updates)
    .where(eq(companies.id, companyId))
    .returning();

  if (!next) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  return Response.json({
    company: {
      id: next.id,
      cnpjDigits: next.cnpjDigits,
      tradeName: next.tradeName,
      systemCode: next.systemCode,
      monthlyRunDay: next.monthlyRunDay,
      createdAt: next.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
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

  const acc = await accessForCompany(db, companyId, s.user.id, isSuperadmin(urow));
  if (!acc.ok) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  if (!canMutateCompanyBusinessData(acc.role)) {
    return jsonError(403, "forbidden", "Sem permissão para esta ação.");
  }

  await db.delete(companies).where(eq(companies.id, companyId));

  return new Response(null, { status: 204 });
}

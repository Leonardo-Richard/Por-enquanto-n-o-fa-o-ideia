import { companyCreateBodySchema, clampMonthlyRunDay } from "@repo/shared";
import { companies, companyMemberships, user } from "@repo/db";
import { getAuthedSession } from "@/app/api/v1/_lib/session";
import { jsonError } from "@/app/api/v1/_lib/http";
import { getDb } from "@/lib/db";
import { canMutateCompanyBusinessData, isSuperadmin } from "@/lib/authz";
import { and, eq } from "drizzle-orm";

export async function POST(request: Request) {
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const body = await request.json().catch(() => null);
  const parsed = companyCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "validation_error", "Dados inválidos.", {
      details: parsed.error.flatten(),
    });
  }

  const db = getDb();
  const [actor] = await db
    .select({ isSuperadmin: user.isSuperadmin })
    .from(user)
    .where(eq(user.id, s.user.id))
    .limit(1);

  const activeCompanyId = (s.session as { activeCompanyId?: string | null })
    .activeCompanyId;

  if (activeCompanyId && actor && !isSuperadmin(actor)) {
    const [roleRow] = await db
      .select({ companyRole: companyMemberships.companyRole })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, activeCompanyId),
          eq(companyMemberships.userId, s.user.id),
        ),
      )
      .limit(1);
    if (!canMutateCompanyBusinessData(roleRow?.companyRole ?? null)) {
      return jsonError(403, "forbidden", "Sem permissão para criar empresa neste contexto.");
    }
  }

  const { cnpjDigits, tradeName, systemCode, monthlyRunDay } = parsed.data;
  const day = clampMonthlyRunDay(monthlyRunDay ?? 1);

  const created = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(companies)
      .values({
        cnpjDigits,
        tradeName: tradeName.trim(),
        systemCode: systemCode.trim(),
        monthlyRunDay: day,
        accountId: s.user.id,
      })
      .returning({
        id: companies.id,
        cnpjDigits: companies.cnpjDigits,
        tradeName: companies.tradeName,
        systemCode: companies.systemCode,
        monthlyRunDay: companies.monthlyRunDay,
        createdAt: companies.createdAt,
      });

    if (!c) {
      throw new Error("insert company failed");
    }

    await tx.insert(companyMemberships).values({
      companyId: c.id,
      userId: s.user.id,
      companyRole: "admin",
    });

    return c;
  });

  return Response.json(
    {
      company: {
        id: created.id,
        cnpjDigits: created.cnpjDigits,
        tradeName: created.tradeName,
        systemCode: created.systemCode,
        monthlyRunDay: created.monthlyRunDay,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

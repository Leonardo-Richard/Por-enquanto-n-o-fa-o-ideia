import { companiesAccessibleQuerySchema, maskCnpjDigits } from "@repo/shared";
import { companies, companyMemberships, user } from "@repo/db";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { getAuthedSession } from "@/app/api/v1/_lib/session";
import { jsonError } from "@/app/api/v1/_lib/http";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { rateLimitMembersSearch } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const rl = await rateLimitMembersSearch(s.user.id);
  if (!rl.ok) {
    return jsonError(429, "rate_limited", "Demasiados pedidos. Tente mais tarde.");
  }

  const url = new URL(request.url);
  const parsed = companiesAccessibleQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return jsonError(400, "validation_error", "Query inválida.", {
      details: parsed.error.flatten(),
    });
  }

  const { q, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;
  const db = getDb();

  const [urow] = await db
    .select({ isSuperadmin: user.isSuperadmin })
    .from(user)
    .where(eq(user.id, s.user.id))
    .limit(1);

  if (!urow) {
    return jsonError(401, "unauthorized", "Utilizador inválido.");
  }

  const qDigits = q ? q.replace(/\D/g, "") : "";
  const searchCond =
    q && q.trim().length > 0
      ? or(
          ilike(companies.tradeName, `%${q.trim()}%`),
          qDigits.length > 0 ? ilike(companies.cnpjDigits, `%${qDigits}%`) : sql`false`,
        )
      : undefined;

  const memberCountExpr = sql<number>`(
    select count(*)::int from company_memberships m where m.company_id = ${companies.id}
  )`;

  if (isSuperadmin(urow)) {
    const totalRows = searchCond
      ? await db.select({ n: count() }).from(companies).where(searchCond)
      : await db.select({ n: count() }).from(companies);
    const total = Number(totalRows[0]?.n ?? 0);

    const base = db
      .select({
        id: companies.id,
        tradeName: companies.tradeName,
        systemCode: companies.systemCode,
        memberCount: memberCountExpr,
        cnpjDigits: companies.cnpjDigits,
      })
      .from(companies)
      .orderBy(asc(companies.tradeName))
      .limit(pageSize)
      .offset(offset);

    const rows = searchCond ? await base.where(searchCond) : await base;

    return Response.json({
      page,
      pageSize,
      total,
      items: rows.map((r) => ({
        id: r.id,
        tradeName: r.tradeName,
        cnpjMasked: maskCnpjDigits(r.cnpjDigits),
        systemCode: r.systemCode,
        memberCount: r.memberCount,
        active: true,
        canOpenCompanyAdmin: true,
        canManageUsers: true,
      })),
    });
  }

  const membershipCond = eq(companyMemberships.userId, s.user.id);
  const where = searchCond ? and(membershipCond, searchCond) : membershipCond;

  const totalRows = await db
    .select({ n: count() })
    .from(companies)
    .innerJoin(companyMemberships, eq(companyMemberships.companyId, companies.id))
    .where(where);
  const total = Number(totalRows[0]?.n ?? 0);

  const rows = await db
    .select({
      id: companies.id,
      tradeName: companies.tradeName,
      cnpjDigits: companies.cnpjDigits,
      systemCode: companies.systemCode,
      companyRole: companyMemberships.companyRole,
      memberCount: memberCountExpr,
    })
    .from(companies)
    .innerJoin(companyMemberships, eq(companyMemberships.companyId, companies.id))
    .where(where)
    .orderBy(asc(companies.tradeName))
    .limit(pageSize)
    .offset(offset);

  return Response.json({
    page,
    pageSize,
    total,
    items: rows.map((r) => ({
      id: r.id,
      tradeName: r.tradeName,
      cnpjMasked: maskCnpjDigits(r.cnpjDigits),
      systemCode: r.systemCode,
      memberCount: r.memberCount,
      active: true,
      canOpenCompanyAdmin: r.companyRole === "admin",
      canManageUsers: r.companyRole === "admin",
    })),
  });
}

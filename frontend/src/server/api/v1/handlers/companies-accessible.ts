import { and, count, eq, ilike, inArray, or } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies, companyMemberships, organizationMemberships } from "@repo/db";
import { companiesAccessibleQuerySchema, maskCnpjDigits } from "@repo/shared";
import { getDb } from "@/lib/db";
import { canManageUsers, isSuperadmin } from "@/lib/authz";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";

function strongerRole(
  a: "user" | "admin" | null | undefined,
  b: "user" | "admin" | null | undefined,
): "user" | "admin" | null {
  const x = a ?? null;
  const y = b ?? null;
  if (x === "admin" || y === "admin") return "admin";
  if (x === "user" || y === "user") return "user";
  return null;
}

export async function handleGetCompaniesAccessible(request: Request) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    const url = new URL(request.url);
    const parsed = companiesAccessibleQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return jsonError(400, "Parâmetros de paginação inválidos.");
    }

    const { page, pageSize, q } = parsed.data;
    const offset = (page - 1) * pageSize;
    const db = getDb();
    const userId = session.user.id;
    const superUser = isSuperadmin(session.user);

    const searchCond = q?.trim()
      ? or(
          ilike(companies.tradeName, `%${q.trim()}%`),
          ilike(companies.cnpjDigits, `%${q.trim()}%`),
          ilike(companies.systemCode, `%${q.trim()}%`),
        )
      : undefined;

    type CompanyRow = InferSelectModel<typeof companies>;
    type Row = CompanyRow & { membershipRole?: "user" | "admin" | null };

    let companyRows: Row[];

    if (superUser) {
      const base = searchCond
        ? db.select().from(companies).where(searchCond)
        : db.select().from(companies);
      companyRows = (await base.limit(pageSize).offset(offset)) as Row[];
    } else {
      const base = db
        .select({
          company: companies,
          companyRole: companyMemberships.companyRole,
          orgRole: organizationMemberships.orgRole,
        })
        .from(companies)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, companies.organizationId),
            eq(organizationMemberships.userId, userId),
          ),
        )
        .leftJoin(
          companyMemberships,
          and(eq(companyMemberships.companyId, companies.id), eq(companyMemberships.userId, userId)),
        );
      const joined = searchCond ? base.where(searchCond) : base;
      const rows = await joined.limit(pageSize).offset(offset);
      companyRows = rows.map(
        (r: {
          company: CompanyRow;
          companyRole: "user" | "admin" | null;
          orgRole: "user" | "admin";
        }) => ({
          ...r.company,
          membershipRole: strongerRole(r.companyRole, r.orgRole),
        }),
      );
    }

    const orgIds = [...new Set(companyRows.map((c) => c.organizationId))];
    const orgMemberCount = new Map<string, number>();
    if (orgIds.length > 0) {
      const countRows = await db
        .select({
          organizationId: organizationMemberships.organizationId,
          cnt: count(),
        })
        .from(organizationMemberships)
        .where(inArray(organizationMemberships.organizationId, orgIds))
        .groupBy(organizationMemberships.organizationId);
      for (const r of countRows) {
        orgMemberCount.set(r.organizationId, Number(r.cnt));
      }
    }

    const activeId = session.session.activeCompanyId ?? null;

    const items = companyRows.map((company) => {
      const roleForFlags = superUser ? null : company.membershipRole ?? null;
      const memberCount = orgMemberCount.get(company.organizationId) ?? 0;
      return {
        id: company.id,
        tradeName: company.tradeName,
        cnpjMasked: maskCnpjDigits(company.cnpjDigits),
        systemCode: company.systemCode,
        memberCount,
        active: activeId === company.id,
        canOpenCompanyAdmin: canManageUsers(session.user, roleForFlags),
        canManageUsers: canManageUsers(session.user, roleForFlags),
      };
    });

    return NextResponse.json(
      { items },
      {
        headers: {
          Deprecation: "true",
          Link: '</api/v1/organizations/accessible>; rel="alternate"',
        },
      },
    );
  } catch (e) {
    return toPublicApiError(e);
  }
}

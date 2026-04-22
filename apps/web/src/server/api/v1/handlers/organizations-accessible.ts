import { and, count, eq, ilike, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { NextResponse } from "next/server";
import { organizationMemberships, organizations } from "@repo/db";
import { companiesAccessibleQuerySchema, maskCnpjDigits } from "@repo/shared";
import { getDb } from "@/lib/db";
import { canManageUsers, isSuperadmin } from "@/lib/authz";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { getEffectiveOrganizationId } from "../lib/active-org";

export async function handleGetOrganizationsAccessible(request: Request) {
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
      ? ilike(organizations.name, `%${q.trim()}%`)
      : undefined;

    type OrgRow = InferSelectModel<typeof organizations>;
    type Row = OrgRow & { membershipRole?: "user" | "admin" };

    let orgRows: Row[];

    if (superUser) {
      const base = searchCond
        ? db.select().from(organizations).where(searchCond)
        : db.select().from(organizations);
      orgRows = (await base.limit(pageSize).offset(offset)) as Row[];
    } else {
      const base = db
        .select({
          org: organizations,
          role: organizationMemberships.orgRole,
        })
        .from(organizations)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, userId),
          ),
        );
      const joined = searchCond ? base.where(searchCond) : base;
      const rows = await joined.limit(pageSize).offset(offset);
      orgRows = rows.map((r: { org: OrgRow; role: "user" | "admin" }) => ({
        ...r.org,
        membershipRole: r.role,
      }));
    }

    const ids = orgRows.map((o) => o.id);
    const countMap = new Map<string, number>();
    if (ids.length > 0) {
      const countRows = await db
        .select({
          organizationId: organizationMemberships.organizationId,
          cnt: count(),
        })
        .from(organizationMemberships)
        .where(inArray(organizationMemberships.organizationId, ids))
        .groupBy(organizationMemberships.organizationId);
      for (const r of countRows) {
        countMap.set(r.organizationId, Number(r.cnt));
      }
    }

    const activeOrgId = await getEffectiveOrganizationId(db, session);

    const items = orgRows.map((org) => {
      const roleForFlags = superUser ? null : org.membershipRole ?? null;
      const memberCount = countMap.get(org.id) ?? 0;
      return {
        id: org.id,
        name: org.name,
        tradeName: org.tradeName,
        taxIdMasked: org.taxIdDigits ? maskCnpjDigits(org.taxIdDigits) : null,
        memberCount,
        active: activeOrgId === org.id,
        canOpenOrgAdmin: canManageUsers(session.user, roleForFlags),
        canManageUsers: canManageUsers(session.user, roleForFlags),
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (e) {
    return toPublicApiError(e);
  }
}

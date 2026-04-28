import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { NextResponse } from "next/server";
import { organizationMemberships, organizations, user } from "@repo/db";
import type { OrganizationDirectoryUserItem, OrganizationMemberListItem } from "@repo/shared";
import { organizationSystemUsersQuerySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";

function logSystemUsers(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "organization_system_users", ...entry }));
}

function sanitizeIlikeFragment(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

function toMemberListItem(row: {
  id: string;
  userId: string;
  email: string;
  name: string;
  orgRole: "user" | "admin";
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OrganizationMemberListItem {
  return {
    membershipId: row.id,
    userId: row.userId,
    email: row.email,
    displayName: row.name,
    orgRole: row.orgRole,
    jobTitle: row.jobTitle,
    department: row.department,
    phone: row.phone,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function handleGetOrganizationSystemUsers(request: Request, organizationIdParam: string) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let outcome: "success" | "validation_error" | "unauthorized" | "forbidden" | "not_found" | "error" = "error";
  let organizationId: string | null = null;

  try {
    const session = await getAuthedSession(request);
    if (!session) {
      outcome = "unauthorized";
      logSystemUsers({ requestId, outcome, organizationId: organizationIdParam });
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!isSuperadmin(session.user)) {
      outcome = "forbidden";
      logSystemUsers({ requestId, outcome, userId: session.user.id, organizationId: organizationIdParam });
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const orgUuid = z.string().uuid().safeParse(organizationIdParam);
    if (!orgUuid.success) {
      outcome = "validation_error";
      logSystemUsers({ requestId, outcome, userId: session.user.id, organizationId: organizationIdParam });
      return jsonError(400, "organizationId inválido.");
    }
    organizationId = orgUuid.data;

    const url = new URL(request.url);
    const parsed = organizationSystemUsersQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      outcome = "validation_error";
      logSystemUsers({ requestId, outcome, userId: session.user.id, organizationId });
      return jsonError(400, "Parâmetros de paginação inválidos.");
    }

    const { page, pageSize, q } = parsed.data;
    const qTrim = typeof q === "string" ? q.trim() : "";
    const safeQ = sanitizeIlikeFragment(qTrim);
    const searchCond =
      safeQ.length > 0 ? or(ilike(user.email, `%${safeQ}%`), ilike(user.name, `%${safeQ}%`)) : undefined;

    const db = getDb();
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      outcome = "not_found";
      logSystemUsers({ requestId, outcome, userId: session.user.id, organizationId });
      return jsonError(404, "Organização não encontrada.");
    }

    const [countRow] = searchCond
      ? await db.select({ c: count() }).from(user).where(searchCond)
      : await db.select({ c: count() }).from(user);
    const total = Number(countRow?.c ?? 0);
    const offset = (page - 1) * pageSize;

    const listBase = db
      .select({
        userId: user.id,
        email: user.email,
        name: user.name,
        isSuperadmin: user.isSuperadmin,
        membershipId: organizationMemberships.id,
        orgRole: organizationMemberships.orgRole,
        jobTitle: organizationMemberships.jobTitle,
        department: organizationMemberships.department,
        phone: organizationMemberships.phone,
        membershipCreatedAt: organizationMemberships.createdAt,
        membershipUpdatedAt: organizationMemberships.updatedAt,
      })
      .from(user)
      .leftJoin(
        organizationMemberships,
        and(
          eq(organizationMemberships.userId, user.id),
          eq(organizationMemberships.organizationId, organizationId),
        ),
      )
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset);

    const rows = searchCond ? await listBase.where(searchCond) : await listBase;

    const items: OrganizationDirectoryUserItem[] = rows.map((r) => {
      const member =
        r.membershipId !== null &&
        r.orgRole !== null &&
        r.membershipCreatedAt !== null &&
        r.membershipUpdatedAt !== null
          ? toMemberListItem({
              id: r.membershipId,
              userId: r.userId,
              email: r.email,
              name: r.name,
              orgRole: r.orgRole,
              jobTitle: r.jobTitle,
              department: r.department,
              phone: r.phone,
              createdAt: r.membershipCreatedAt,
              updatedAt: r.membershipUpdatedAt,
            })
          : null;

      return {
        userId: r.userId,
        email: r.email,
        displayName: r.name,
        isSuperadmin: r.isSuperadmin,
        member,
      };
    });

    outcome = "success";
    logSystemUsers({
      requestId,
      outcome,
      userId: session.user.id,
      organizationId,
      total,
      page,
      hasQuery: safeQ.length > 0,
    });
    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
    });
  } catch (e) {
    outcome = "error";
    logSystemUsers({ requestId, outcome, organizationId: organizationId ?? organizationIdParam });
    return toPublicApiError(e);
  }
}

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import {
  account,
  organizationMemberships,
  organizations,
  user,
  type Db,
} from "@repo/db";
import {
  type OrganizationMemberListItem,
  organizationMemberPostBodySchema,
  organizationMembersQuerySchema,
} from "@repo/shared";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { jsonOrganizationMembersError } from "../lib/org-members-json";
import { consumeOrgMembersSearchSlot, ORG_MEMBERS_SEARCH_RATE } from "../lib/organization-members-search-rate-limit";

const MEMBERSHIP_UNIQUE = "organization_memberships_user_org_unique";

function isPgUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505";
}

function logMembers(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "organization_members", ...entry }));
}

function sanitizeIlikeFragment(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

export function toMemberListItem(row: {
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

export async function handleGetOrganizationMembers(request: Request, organizationIdParam: string) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let outcome: "success" | "validation_error" | "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "error" =
    "error";
  let organizationId: string | null = null;

  try {
    const session = await getAuthedSession(request);
    if (!session) {
      outcome = "unauthorized";
      logMembers({ requestId, outcome, organizationId: organizationIdParam });
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!isSuperadmin(session.user)) {
      outcome = "forbidden";
      logMembers({ requestId, outcome, userId: session.user.id, organizationId: organizationIdParam });
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const orgUuid = z.string().uuid().safeParse(organizationIdParam);
    if (!orgUuid.success) {
      outcome = "validation_error";
      logMembers({ requestId, outcome, userId: session.user.id, organizationId: organizationIdParam });
      return jsonError(400, "organizationId inválido.");
    }
    organizationId = orgUuid.data;

    const url = new URL(request.url);
    const parsed = organizationMembersQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      outcome = "validation_error";
      logMembers({ requestId, outcome, userId: session.user.id, organizationId });
      return jsonError(400, "Parâmetros de paginação inválidos.");
    }

    const { page, pageSize, q } = parsed.data;
    const qTrim = q?.trim() ?? "";
    if (qTrim.length > 0) {
      const rateKey = `${session.user.id}:${organizationId}`;
      if (!consumeOrgMembersSearchSlot(rateKey)) {
        outcome = "rate_limited";
        logMembers({
          requestId,
          outcome,
          userId: session.user.id,
          organizationId,
          rateLimit: ORG_MEMBERS_SEARCH_RATE,
        });
        return jsonOrganizationMembersError(
          429,
          "Demasiadas pesquisas. Aguarde um momento antes de tentar novamente.",
        );
      }
    }

    const db = getDb();
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      outcome = "not_found";
      logMembers({ requestId, outcome, userId: session.user.id, organizationId });
      return jsonError(404, "Organização não encontrada.");
    }

    const safeQ = sanitizeIlikeFragment(qTrim);
    const searchCond =
      safeQ.length > 0
        ? or(ilike(user.email, `%${safeQ}%`), ilike(user.name, `%${safeQ}%`))
        : undefined;

    const whereBase = eq(organizationMemberships.organizationId, organizationId);
    const whereAll = searchCond ? and(whereBase, searchCond) : whereBase;

    const [countRow] = await db
      .select({ c: count() })
      .from(organizationMemberships)
      .innerJoin(user, eq(user.id, organizationMemberships.userId))
      .where(whereAll);

    const total = Number(countRow?.c ?? 0);
    const offset = (page - 1) * pageSize;

    const rows = await db
      .select({
        id: organizationMemberships.id,
        userId: organizationMemberships.userId,
        email: user.email,
        name: user.name,
        orgRole: organizationMemberships.orgRole,
        jobTitle: organizationMemberships.jobTitle,
        department: organizationMemberships.department,
        phone: organizationMemberships.phone,
        createdAt: organizationMemberships.createdAt,
        updatedAt: organizationMemberships.updatedAt,
      })
      .from(organizationMemberships)
      .innerJoin(user, eq(user.id, organizationMemberships.userId))
      .where(whereAll)
      .orderBy(desc(organizationMemberships.createdAt))
      .limit(pageSize)
      .offset(offset);

    outcome = "success";
    logMembers({ requestId, outcome, userId: session.user.id, organizationId, total });
    return NextResponse.json({
      items: rows.map(toMemberListItem),
      page,
      pageSize,
      total,
    });
  } catch (e) {
    outcome = "error";
    logMembers({ requestId, outcome, organizationId: organizationId ?? organizationIdParam });
    return toPublicApiError(e);
  }
}

export async function handlePostOrganizationMembers(request: Request, organizationIdParam: string) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let organizationId: string | null = null;
  let outcome: "success" | "validation_error" | "unauthorized" | "forbidden" | "not_found" | "error" = "error";

  try {
    const session = await getAuthedSession(request);
    if (!session) {
      outcome = "unauthorized";
      logMembers({ requestId, outcome, organizationId: organizationIdParam });
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!isSuperadmin(session.user)) {
      outcome = "forbidden";
      logMembers({ requestId, outcome, userId: session.user.id, organizationId: organizationIdParam });
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const orgUuidPost = z.string().uuid().safeParse(organizationIdParam);
    if (!orgUuidPost.success) {
      outcome = "validation_error";
      return jsonError(400, "organizationId inválido.");
    }
    organizationId = orgUuidPost.data;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      outcome = "validation_error";
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = organizationMemberPostBodySchema.safeParse(raw);
    if (!parsed.success) {
      outcome = "validation_error";
      const flat = parsed.error.flatten();
      const msg =
        Object.values(flat.fieldErrors)[0]?.[0] ?? flat.formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const db = getDb();
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      outcome = "not_found";
      return jsonError(404, "Organização não encontrada.");
    }

    const orgPk = org.id;

    if (parsed.data.mode === "link") {
      const { email, orgRole } = parsed.data;
      const normalizedEmail = email.toLowerCase();
      const [target] = await db
        .select({ id: user.id })
        .from(user)
        .where(sql`lower(${user.email}) = ${normalizedEmail}`)
        .limit(1);

      if (!target) {
        outcome = "validation_error";
        logMembers({ requestId, outcome: "user_not_found", userId: session.user.id, organizationId });
        return jsonOrganizationMembersError(
          400,
          "Não existe utilizador registado com este e-mail.",
          "USER_NOT_FOUND",
        );
      }

      try {
        const row = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(organizationMemberships)
            .values({
              organizationId: orgPk,
              userId: target.id,
              orgRole,
            })
            .returning();

          if (!inserted) {
            throw new Error("Falha ao criar vínculo.");
          }

          await insertAuditEvent(tx as unknown as Db, {
            actorUserId: session.user.id,
            targetUserId: target.id,
            organizationId: orgPk,
            eventType: "membership_created",
            metadata: { membershipId: inserted.id, mode: "link", orgRole },
          });

          const [full] = await tx
            .select({
              id: organizationMemberships.id,
              userId: organizationMemberships.userId,
              email: user.email,
              name: user.name,
              orgRole: organizationMemberships.orgRole,
              jobTitle: organizationMemberships.jobTitle,
              department: organizationMemberships.department,
              phone: organizationMemberships.phone,
              createdAt: organizationMemberships.createdAt,
              updatedAt: organizationMemberships.updatedAt,
            })
            .from(organizationMemberships)
            .innerJoin(user, eq(user.id, organizationMemberships.userId))
            .where(eq(organizationMemberships.id, inserted.id))
            .limit(1);

          return full;
        });

        if (!row) {
          throw new Error("Membro não encontrado após criação.");
        }

        outcome = "success";
        logMembers({ requestId, outcome, userId: session.user.id, organizationId });
        return NextResponse.json(toMemberListItem(row), { status: 201 });
      } catch (e) {
        if (isPgUniqueViolation(e)) {
          const cn = (e as { constraint_name?: string }).constraint_name ?? "";
          const blob = `${cn} ${(e as Error).message ?? ""}`;
          if (blob.includes(MEMBERSHIP_UNIQUE) || blob.includes("user_org")) {
            outcome = "validation_error";
            return jsonOrganizationMembersError(
              409,
              "Este utilizador já é membro desta organização.",
              "MEMBERSHIP_DUPLICATE",
            );
          }
        }
        throw e;
      }
    }

    /* mode === "create" */
    const { email, password, name, orgRole, jobTitle, department, phone } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${normalizedEmail}`)
      .limit(1);
    if (existing) {
      outcome = "validation_error";
      return jsonOrganizationMembersError(
        409,
        "Já existe uma conta com este e-mail.",
        "USER_EMAIL_CONFLICT",
      );
    }

    const hashed = await hashPassword(password);
    const newUserId = randomUUID();
    const newAccountId = randomUUID();

    try {
      const row = await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: newUserId,
          name: name.trim(),
          email: normalizedEmail,
          emailVerified: false,
          isSuperadmin: false,
        });

        await tx.insert(account).values({
          id: newAccountId,
          accountId: newUserId,
          providerId: "credential",
          userId: newUserId,
          password: hashed,
        });

        const [inserted] = await tx
          .insert(organizationMemberships)
          .values({
            organizationId: orgPk,
            userId: newUserId,
            orgRole,
            ...(jobTitle !== undefined ? { jobTitle } : {}),
            ...(department !== undefined ? { department } : {}),
            ...(phone !== undefined ? { phone } : {}),
          })
          .returning();

        if (!inserted) {
          throw new Error("Falha ao criar vínculo.");
        }

        await insertAuditEvent(tx as unknown as Db, {
          actorUserId: session.user.id,
          targetUserId: newUserId,
          organizationId: orgPk,
          eventType: "membership_created",
          metadata: { membershipId: inserted.id, mode: "create", orgRole },
        });

        const [full] = await tx
          .select({
            id: organizationMemberships.id,
            userId: organizationMemberships.userId,
            email: user.email,
            name: user.name,
            orgRole: organizationMemberships.orgRole,
            jobTitle: organizationMemberships.jobTitle,
            department: organizationMemberships.department,
            phone: organizationMemberships.phone,
            createdAt: organizationMemberships.createdAt,
            updatedAt: organizationMemberships.updatedAt,
          })
          .from(organizationMemberships)
          .innerJoin(user, eq(user.id, organizationMemberships.userId))
          .where(eq(organizationMemberships.id, inserted.id))
          .limit(1);

        return full;
      });

      if (!row) {
        throw new Error("Membro não encontrado após criação.");
      }

      outcome = "success";
      logMembers({ requestId, outcome, userId: session.user.id, organizationId });
      return NextResponse.json(toMemberListItem(row), { status: 201 });
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        const cn = (e as { constraint_name?: string }).constraint_name ?? "";
        const blob = `${cn} ${(e as Error).message ?? ""}`;
        if (blob.includes(MEMBERSHIP_UNIQUE) || blob.includes("user_org")) {
          return jsonOrganizationMembersError(
            409,
            "Este utilizador já é membro desta organização.",
            "MEMBERSHIP_DUPLICATE",
          );
        }
        if (blob.toLowerCase().includes("email") || blob.includes("user_email")) {
          return jsonOrganizationMembersError(409, "Já existe uma conta com este e-mail.", "USER_EMAIL_CONFLICT");
        }
      }
      throw e;
    }
  } catch (e) {
    outcome = "error";
    logMembers({ requestId, outcome, organizationId: organizationId ?? organizationIdParam });
    return toPublicApiError(e);
  }
}

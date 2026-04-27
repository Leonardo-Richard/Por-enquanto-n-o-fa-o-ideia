import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { organizationMemberships, organizations, user, type Db } from "@repo/db";
import { organizationMemberPatchBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { jsonOrganizationMembersError } from "../lib/org-members-json";
import { countOrganizationAdmins } from "../lib/organization-members-fr108";
import { toMemberListItem } from "./organization-members";

function logMembershipById(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "organization_membership_by_id", ...entry }));
}

export async function handlePatchOrganizationMembership(
  request: Request,
  organizationIdParam: string,
  membershipIdParam: string,
) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let outcome: "success" | "validation_error" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "error" =
    "error";

  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!isSuperadmin(session.user)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const orgId = z.string().uuid().safeParse(organizationIdParam);
    const memId = z.string().uuid().safeParse(membershipIdParam);
    if (!orgId.success || !memId.success) {
      outcome = "validation_error";
      return jsonError(400, "Identificador inválido.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = organizationMemberPatchBodySchema.safeParse(raw);
    if (!parsed.success) {
      outcome = "validation_error";
      const flat = parsed.error.flatten();
      const msg =
        Object.values(flat.fieldErrors)[0]?.[0] ?? flat.formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const patch = parsed.data;
    if (
      patch.orgRole === undefined &&
      patch.jobTitle === undefined &&
      patch.department === undefined &&
      patch.phone === undefined
    ) {
      return jsonError(400, "Nenhum campo para atualizar.");
    }

    const db = getDb();
    const [orgRow] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId.data))
      .limit(1);
    if (!orgRow) {
      outcome = "not_found";
      return jsonError(404, "Organização não encontrada.");
    }

    const row = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: organizationMemberships.id,
          userId: organizationMemberships.userId,
          orgRole: organizationMemberships.orgRole,
        })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.id, memId.data),
            eq(organizationMemberships.organizationId, orgId.data),
          ),
        )
        .for("update")
        .limit(1);
      if (!current) {
        return { type: "not_found" as const };
      }

      if (patch.orgRole === "user" && current.orgRole === "admin") {
        const admins = await countOrganizationAdmins(tx as unknown as Db, orgId.data);
        if (admins <= 1) {
          return { type: "last_admin" as const };
        }
      }

      const updates: Partial<typeof organizationMemberships.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (patch.orgRole !== undefined) {
        updates.orgRole = patch.orgRole;
      }
      if (patch.jobTitle !== undefined) {
        updates.jobTitle = patch.jobTitle;
      }
      if (patch.department !== undefined) {
        updates.department = patch.department;
      }
      if (patch.phone !== undefined) {
        updates.phone = patch.phone;
      }

      await tx
        .update(organizationMemberships)
        .set(updates)
        .where(
          and(eq(organizationMemberships.id, memId.data), eq(organizationMemberships.organizationId, orgId.data)),
        );

      const roleChanged = patch.orgRole !== undefined && patch.orgRole !== current.orgRole;
      const metaChanged =
        patch.jobTitle !== undefined || patch.department !== undefined || patch.phone !== undefined;
      if (roleChanged || metaChanged) {
        await insertAuditEvent(tx as unknown as Db, {
          actorUserId: session.user.id,
          targetUserId: current.userId,
          organizationId: orgId.data,
          eventType: "membership_role_changed",
          metadata: {
            membershipId: memId.data,
            previousRole: current.orgRole,
            nextRole: patch.orgRole ?? current.orgRole,
            ...(metaChanged
              ? {
                  jobTitle: patch.jobTitle !== undefined,
                  department: patch.department !== undefined,
                  phone: patch.phone !== undefined,
                }
              : {}),
          },
        });
      }

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
        .where(eq(organizationMemberships.id, memId.data))
        .limit(1);

      return { type: "ok" as const, full };
    });

    if (row.type === "not_found") {
      outcome = "not_found";
      logMembershipById({ requestId, outcome, organizationId: orgId.data, membershipId: memId.data });
      return jsonError(404, "Membro não encontrado.");
    }
    if (row.type === "last_admin") {
      outcome = "conflict";
      logMembershipById({ requestId, outcome, organizationId: orgId.data, membershipId: memId.data });
      return jsonOrganizationMembersError(
        409,
        "É necessário pelo menos um administrador da organização.",
        "LAST_ORG_ADMIN",
      );
    }

    outcome = "success";
    logMembershipById({ requestId, outcome, organizationId: orgId.data, membershipId: memId.data });
    return NextResponse.json(toMemberListItem(row.full));
  } catch (e) {
    outcome = "error";
    logMembershipById({ requestId, outcome });
    return toPublicApiError(e);
  }
}

export async function handleDeleteOrganizationMembership(
  request: Request,
  organizationIdParam: string,
  membershipIdParam: string,
) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let outcome: "success" | "validation_error" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "error" =
    "error";

  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!isSuperadmin(session.user)) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const orgId = z.string().uuid().safeParse(organizationIdParam);
    const memId = z.string().uuid().safeParse(membershipIdParam);
    if (!orgId.success || !memId.success) {
      outcome = "validation_error";
      return jsonError(400, "Identificador inválido.");
    }

    const db = getDb();
    const [orgRowDel] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId.data))
      .limit(1);
    if (!orgRowDel) {
      outcome = "not_found";
      return jsonError(404, "Organização não encontrada.");
    }

    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: organizationMemberships.id,
          userId: organizationMemberships.userId,
          orgRole: organizationMemberships.orgRole,
        })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.id, memId.data),
            eq(organizationMemberships.organizationId, orgId.data),
          ),
        )
        .for("update")
        .limit(1);
      if (!current) {
        return { type: "not_found" as const };
      }

      if (current.orgRole === "admin") {
        const admins = await countOrganizationAdmins(tx as unknown as Db, orgId.data);
        if (admins <= 1) {
          return { type: "last_admin" as const };
        }
      }

      await insertAuditEvent(tx as unknown as Db, {
        actorUserId: session.user.id,
        targetUserId: current.userId,
        organizationId: orgId.data,
        eventType: "membership_removed",
        metadata: { membershipId: memId.data, orgRole: current.orgRole },
      });

      await tx
        .delete(organizationMemberships)
        .where(
          and(eq(organizationMemberships.id, memId.data), eq(organizationMemberships.organizationId, orgId.data)),
        );

      return { type: "ok" as const };
    });

    if (result.type === "not_found") {
      outcome = "not_found";
      logMembershipById({ requestId, outcome, organizationId: orgId.data, membershipId: memId.data });
      return jsonError(404, "Membro não encontrado.");
    }
    if (result.type === "last_admin") {
      outcome = "conflict";
      return jsonOrganizationMembersError(
        409,
        "É necessário pelo menos um administrador da organização.",
        "LAST_ORG_ADMIN",
      );
    }

    outcome = "success";
    logMembershipById({ requestId, outcome, organizationId: orgId.data, membershipId: memId.data });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    outcome = "error";
    logMembershipById({ requestId, outcome });
    return toPublicApiError(e);
  }
}

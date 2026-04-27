import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { organizations, type Db } from "@repo/db";
import { maskCnpjDigits, organizationCreateBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { hasOrganizationLocalAdmin } from "../lib/organization-local-admin";

function isPostgresUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505";
}

const TAX_ID_UNIQUE_INDEX = "organizations_tax_id_digits_unique_partial";

/** `409` apenas para conflito de CNPJ da organização (índice parcial), não outros `23505`. */
function isOrganizationTaxIdUniqueViolation(e: unknown): boolean {
  if (!isPostgresUniqueViolation(e)) {
    return false;
  }
  const o = e as { constraint_name?: string; detail?: string; message?: string };
  if (o.constraint_name === TAX_ID_UNIQUE_INDEX) {
    return true;
  }
  const blob = `${o.detail ?? ""} ${o.message ?? ""}`;
  return blob.includes(TAX_ID_UNIQUE_INDEX) || blob.includes("tax_id_digits");
}

function logOrganizationsCreate(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "organizations_create", ...entry }));
}

export async function handlePostOrganizationsCreate(request: Request) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let outcome: "success" | "validation_error" | "unauthorized" | "forbidden" | "conflict" | "error" =
    "error";
  let organizationId: string | null = null;
  let userId: string | null = null;
  /** Após passar o gate de superadmin — usado nos logs do `catch` externo. */
  let isSuperadminActor = false;

  try {
    const session = await getAuthedSession(request);
    if (!session) {
      outcome = "unauthorized";
      logOrganizationsCreate({
        requestId,
        userId: null,
        organizationId: null,
        outcome,
        isSuperadmin: false,
      });
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    userId = session.user.id;
    const superadmin = isSuperadmin(session.user);

    if (!superadmin) {
      outcome = "forbidden";
      logOrganizationsCreate({
        requestId,
        userId,
        organizationId: null,
        outcome,
        isSuperadmin: false,
      });
      return jsonError(403, "Não tem permissão para esta operação.");
    }
    isSuperadminActor = true;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      outcome = "validation_error";
      logOrganizationsCreate({
        requestId,
        userId,
        organizationId: null,
        outcome,
        isSuperadmin: superadmin,
      });
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = organizationCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      outcome = "validation_error";
      logOrganizationsCreate({
        requestId,
        userId,
        organizationId: null,
        outcome,
        isSuperadmin: superadmin,
      });
      const flat = parsed.error.flatten();
      const first = flat.fieldErrors;
      const msg =
        (first.name && first.name[0]) ||
        (first.tradeName && first.tradeName[0]) ||
        (first.taxIdDigits && first.taxIdDigits[0]) ||
        flat.formErrors[0] ||
        "Dados inválidos.";
      return jsonError(400, msg);
    }

    const { name, tradeName, taxIdDigits } = parsed.data;
    const sourceHeader = request.headers.get("x-organization-create-source")?.trim().toLowerCase();
    const source = sourceHeader === "admin_ui" ? "admin_ui" : "api";

    const db = getDb();

    try {
      const row = await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({
            name,
            tradeName,
            taxIdDigits,
            active: true,
          })
          .returning();

        if (!org) {
          throw new Error("Falha ao criar organização.");
        }

        await insertAuditEvent(tx as unknown as Db, {
          actorUserId: session.user.id,
          organizationId: org.id,
          eventType: "organization_created_by_superadmin",
          metadata: {
            source,
            taxIdProvided: taxIdDigits !== null,
          },
        });

        const localAdminLinked = await hasOrganizationLocalAdmin(tx as unknown as Db, org.id);
        return { org, localAdminLinked };
      });

      organizationId = row.org.id;
      outcome = "success";
      logOrganizationsCreate({
        requestId,
        userId,
        organizationId,
        outcome,
        isSuperadmin: true,
      });

      return NextResponse.json(
        {
          id: row.org.id,
          name: row.org.name,
          tradeName: row.org.tradeName,
          taxIdMasked: row.org.taxIdDigits ? maskCnpjDigits(row.org.taxIdDigits) : null,
          createdAt: row.org.createdAt.toISOString(),
          localAdminLinked: row.localAdminLinked,
        },
        { status: 201 },
      );
    } catch (e) {
      if (isOrganizationTaxIdUniqueViolation(e)) {
        outcome = "conflict";
        logOrganizationsCreate({
          requestId,
          userId,
          organizationId: null,
          outcome,
          isSuperadmin: true,
        });
        return jsonError(409, "Já existe uma organização com este CNPJ.");
      }
      throw e;
    }
  } catch (e) {
    outcome = "error";
    logOrganizationsCreate({
      requestId,
      userId,
      organizationId,
      outcome,
      isSuperadmin: isSuperadminActor,
    });
    return toPublicApiError(e);
  }
}

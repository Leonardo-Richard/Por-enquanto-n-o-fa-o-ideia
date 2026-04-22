import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { organizations, session as sessionTable } from "@repo/db";
import { activeOrganizationBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { isSuperadmin } from "@/lib/authz";
import { insertAuditEvent } from "@/lib/audit";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { canAccessOrganization } from "../lib/active-org";

export async function handlePostSessionActiveOrganization(request: Request) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "Corpo JSON inválido.");
    }

    const parsed = activeOrganizationBodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "Identificador de organização inválido.");
    }

    const { organizationId } = parsed.data;
    const db = getDb();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) {
      return jsonError(404, "Organização não encontrada.");
    }

    const superadmin = isSuperadmin(session.user);
    const allowed = await canAccessOrganization(db, session.user.id, organizationId, superadmin);
    if (!allowed) {
      return jsonError(403, "Não tem permissão para esta operação.");
    }

    const prevOrg = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;

    await db
      .update(sessionTable)
      .set({ activeOrganizationId: organizationId, updatedAt: new Date() })
      .where(eq(sessionTable.id, session.session.id));

    await insertAuditEvent(db, {
      actorUserId: session.user.id,
      organizationId,
      eventType: "active_organization_set",
      metadata: { previousOrganizationId: prevOrg, newOrganizationId: organizationId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toPublicApiError(e);
  }
}

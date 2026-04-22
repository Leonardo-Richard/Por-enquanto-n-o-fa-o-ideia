import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { organizations } from "@repo/db";
import { getDb } from "@/lib/db";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import { getEffectiveOrganizationId } from "../lib/active-org";

export async function handleGetMe(request: Request) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    const db = getDb();
    const effectiveOrganizationId = await getEffectiveOrganizationId(db, session);
    let activeOrganizationName: string | null = null;
    if (effectiveOrganizationId) {
      const [row] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, effectiveOrganizationId))
        .limit(1);
      activeOrganizationName = row?.name ?? null;
    }
    const sess = session.session as {
      activeCompanyId?: string | null;
      activeOrganizationId?: string | null;
    };
    return NextResponse.json({
      isSuperadmin: Boolean(session.user.isSuperadmin),
      activeCompanyId: sess.activeCompanyId ?? null,
      activeOrganizationId: sess.activeOrganizationId ?? null,
      effectiveOrganizationId,
      activeOrganizationName,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        isSuperadmin: Boolean(session.user.isSuperadmin),
      },
    });
  } catch (e) {
    return toPublicApiError(e);
  }
}

import { activeCompanyBodySchema } from "@repo/shared";
import {
  companies,
  companyMemberships,
  session as sessionTable,
  user,
} from "@repo/db";
import { and, eq } from "drizzle-orm";
import { getAuthedSession } from "@/app/api/v1/_lib/session";
import { jsonError } from "@/app/api/v1/_lib/http";
import { getDb } from "@/lib/db";
import { insertAuditEvent } from "@/lib/audit";
import { isSuperadmin } from "@/lib/authz";

export async function POST(request: Request) {
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const body = await request.json().catch(() => null);
  const parsed = activeCompanyBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "validation_error", "Payload inválido.", {
      details: parsed.error.flatten(),
    });
  }

  const { companyId } = parsed.data;
  const db = getDb();

  const [urow] = await db
    .select({ isSuperadmin: user.isSuperadmin })
    .from(user)
    .where(eq(user.id, s.user.id))
    .limit(1);

  if (!urow) {
    return jsonError(401, "unauthorized", "Utilizador inválido.");
  }

  const [co] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!co) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  let allowed = isSuperadmin(urow);
  if (!allowed) {
    const [m] = await db
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.userId, s.user.id),
        ),
      )
      .limit(1);
    allowed = Boolean(m);
  }

  if (!allowed) {
    return jsonError(404, "not_found", "Não encontrado.");
  }

  const previousCompanyId =
    (s.session as { activeCompanyId?: string | null }).activeCompanyId ?? null;

  await db
    .update(sessionTable)
    .set({
      activeCompanyId: companyId,
      updatedAt: new Date(),
    })
    .where(eq(sessionTable.id, s.session.id));

  await insertAuditEvent(db, {
    actorUserId: s.user.id,
    companyId,
    eventType: "active_company_set",
    metadata: {
      previousCompanyId,
      newCompanyId: companyId,
    },
  });

  return new Response(null, { status: 204 });
}

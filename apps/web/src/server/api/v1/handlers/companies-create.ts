import { NextResponse } from "next/server";
import { companies, companyMemberships } from "@repo/db";
import { clampMonthlyRunDay, companyCreateBodySchema } from "@repo/shared";
import { getDb } from "@/lib/db";
import { jsonError, toPublicApiError } from "../lib/errors";
import { rowToCompany } from "../lib/company-mapper";
import { getAuthedSession } from "../lib/session";

export async function handlePostCompanies(request: Request) {
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

    const parsed = companyCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Dados inválidos.";
      return jsonError(400, msg);
    }

    const { cnpjDigits, tradeName, systemCode, monthlyRunDay } = parsed.data;
    const day = clampMonthlyRunDay(monthlyRunDay ?? 1);
    const db = getDb();

    const [created] = await db
      .insert(companies)
      .values({
        cnpjDigits,
        tradeName: tradeName.trim() || "Sem nome fantasia",
        systemCode: systemCode.trim(),
        monthlyRunDay: day,
        accountId: session.user.id,
      })
      .returning();

    if (!created) {
      return jsonError(500, "Não foi possível criar a empresa.");
    }

    await db.insert(companyMemberships).values({
      companyId: created.id,
      userId: session.user.id,
      companyRole: "admin",
    });

    return NextResponse.json({ company: rowToCompany(created) }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505") {
      return jsonError(409, "CNPJ ou código já registado.");
    }
    return toPublicApiError(e);
  }
}

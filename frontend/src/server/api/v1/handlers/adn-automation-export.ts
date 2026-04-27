import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { companies } from "@repo/db";
import { toPublicApiError } from "../lib/errors";
import { assertAdnOrgAdmin, resolveAdnPublicAccess } from "./adn-public-access";

export async function handleGetAdnAutomationExport(request: Request, organizationId: string, companyId: string) {
  try {
    const gate = await resolveAdnPublicAccess(request, organizationId, companyId);
    if (!gate.ok) {
      return gate.response;
    }
    const adminBlock = assertAdnOrgAdmin(gate.ctx);
    if (adminBlock) {
      return adminBlock;
    }

    const { db } = gate.ctx;
    const rows = await db
      .select({
        id: companies.id,
        cnpjDigits: companies.cnpjDigits,
        tradeName: companies.tradeName,
        systemCode: companies.systemCode,
      })
      .from(companies)
      .where(eq(companies.organizationId, organizationId));

    const payload = {
      generatedAt: new Date().toISOString(),
      organizationId,
      monitoredCompanies: rows.map((r) => ({
        id: r.id,
        cnpj_digits: r.cnpjDigits,
        trade_name: r.tradeName,
        system_code: r.systemCode,
      })),
    };

    const body = JSON.stringify(payload, null, 2);
    const filename = `automation-export-${organizationId}.json`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return toPublicApiError(e);
  }
}

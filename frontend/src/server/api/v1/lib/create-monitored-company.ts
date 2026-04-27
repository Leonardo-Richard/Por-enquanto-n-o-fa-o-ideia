import type { InferSelectModel } from "drizzle-orm";
import { companies, companyMemberships } from "@repo/db";
import type { Db } from "@repo/db";
import type { AuthedSession } from "./session";

export type CreatedCompanyRow = InferSelectModel<typeof companies>;

export async function createMonitoredCompany(
  db: Db,
  session: AuthedSession,
  input: {
    organizationId: string;
    cnpjDigits: string;
    tradeName: string;
    systemCode: string;
    monthlyRunDay: number;
  },
): Promise<CreatedCompanyRow> {
  const [created] = await db
    .insert(companies)
    .values({
      organizationId: input.organizationId,
      cnpjDigits: input.cnpjDigits,
      tradeName: input.tradeName.trim() || "Sem nome fantasia",
      systemCode: input.systemCode.trim(),
      monthlyRunDay: input.monthlyRunDay,
      accountId: session.user.id,
    })
    .returning();

  if (!created) {
    throw new Error("insert_company_failed");
  }

  await db.insert(companyMemberships).values({
    companyId: created.id,
    userId: session.user.id,
    companyRole: "admin",
  });

  return created;
}

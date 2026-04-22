import type { InferSelectModel } from "drizzle-orm";
import type { companies as companiesTable } from "@repo/db";
import type { Company } from "@repo/shared";

export function rowToCompany(row: InferSelectModel<typeof companiesTable>): Company {
  return {
    id: row.id,
    cnpjDigits: row.cnpjDigits,
    tradeName: row.tradeName,
    systemCode: row.systemCode,
    monthlyRunDay: row.monthlyRunDay,
    createdAt: row.createdAt.toISOString(),
  };
}

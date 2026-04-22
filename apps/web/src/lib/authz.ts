import type { InferSelectModel } from "drizzle-orm";
import type { user as userTable } from "@repo/db";

export type AuthUserRow = InferSelectModel<typeof userTable>;

export function isSuperadmin(user: Pick<AuthUserRow, "isSuperadmin">): boolean {
  return user.isSuperadmin === true;
}

export function canListCompany(
  user: Pick<AuthUserRow, "isSuperadmin" | "id">,
  hasMembership: boolean,
): boolean {
  return isSuperadmin(user) || hasMembership;
}

export function canManageUsers(
  user: Pick<AuthUserRow, "isSuperadmin" | "id">,
  role: "user" | "admin" | null,
): boolean {
  if (isSuperadmin(user)) {
    return true;
  }
  return role === "admin";
}

/** MVP: mutações fiscais/dados de negócio exigem admin na empresa (superadmin sem membership não muta). */
export function canMutateCompanyBusinessData(role: "user" | "admin" | null): boolean {
  return role === "admin";
}

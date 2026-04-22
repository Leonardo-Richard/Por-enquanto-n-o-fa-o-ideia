import type { InferSelectModel } from "drizzle-orm";
import type { user as userTable } from "@repo/db";

export type AuthUserRow = InferSelectModel<typeof userTable>;

export function isSuperadmin(user: Pick<AuthUserRow, "isSuperadmin"> | { isSuperadmin?: boolean | null }): boolean {
  return user.isSuperadmin === true;
}

type AuthzUser = Pick<AuthUserRow, "isSuperadmin" | "id"> | { id: string; isSuperadmin?: boolean | null };

export function canListCompany(user: AuthzUser, hasMembership: boolean): boolean {
  return isSuperadmin(user) || hasMembership;
}

export function canManageUsers(user: AuthzUser, role: "user" | "admin" | null): boolean {
  if (isSuperadmin(user)) {
    return true;
  }
  return role === "admin";
}

/** MVP: mutações fiscais/dados de negócio exigem admin na empresa (superadmin sem membership não muta). */
export function canMutateCompanyBusinessData(role: "user" | "admin" | null): boolean {
  return role === "admin";
}

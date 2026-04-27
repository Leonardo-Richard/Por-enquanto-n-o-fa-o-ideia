import { NextResponse } from "next/server";

export type OrganizationMembersErrorCode =
  | "LAST_ORG_ADMIN"
  | "MEMBERSHIP_DUPLICATE"
  | "USER_NOT_FOUND"
  | "USER_EMAIL_CONFLICT";

/** Resposta JSON alinhada a NFR33 / SMEM-01 (`error` + `code` estável + `message` para clientes legados). */
export function jsonOrganizationMembersError(
  status: number,
  error: string,
  code?: OrganizationMembersErrorCode,
) {
  return NextResponse.json(
    {
      error,
      message: error,
      ...(code ? { code } : {}),
    },
    { status },
  );
}

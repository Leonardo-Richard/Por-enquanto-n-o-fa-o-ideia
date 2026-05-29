import { NextResponse } from "next/server";
import { isSuperadmin, type AuthzUser } from "@/lib/authz";
import { jsonError } from "./errors";
import { getAuthedSession, type AuthedSession } from "./session";

export async function requireAuthedSession(
  request: Request,
): Promise<AuthedSession | NextResponse> {
  const session = await getAuthedSession(request);
  if (!session) {
    return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
  }
  return session;
}

export async function requireSuperadminSession(
  request: Request,
): Promise<AuthedSession | NextResponse> {
  const session = await requireAuthedSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isSuperadmin(session.user)) {
    return jsonError(403, "Não tem permissão para esta operação.");
  }
  return session;
}

export function isAuthedSession(value: AuthedSession | NextResponse): value is AuthedSession {
  return !(value instanceof NextResponse);
}

export function isSuperadminUser(user: AuthzUser): boolean {
  return isSuperadmin(user);
}

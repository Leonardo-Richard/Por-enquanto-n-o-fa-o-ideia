import { NextResponse } from "next/server";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";

export async function handleGetMe(request: Request) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    return NextResponse.json({
      isSuperadmin: Boolean(session.user.isSuperadmin),
    });
  } catch (e) {
    return toPublicApiError(e);
  }
}

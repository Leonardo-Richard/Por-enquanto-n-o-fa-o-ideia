import { getAuthedSession } from "@/app/api/v1/_lib/session";
import { jsonError } from "@/app/api/v1/_lib/http";

export async function GET() {
  const s = await getAuthedSession();
  if (!s) {
    return jsonError(401, "unauthorized", "Sessão necessária.");
  }

  const isSuperadmin = Boolean(
    (s.user as { isSuperadmin?: boolean }).isSuperadmin,
  );
  const activeCompanyId =
    (s.session as { activeCompanyId?: string | null }).activeCompanyId ?? null;

  return Response.json({
    user: {
      id: s.user.id,
      email: s.user.email,
      name: s.user.name,
    },
    isSuperadmin,
    activeCompanyId,
  });
}

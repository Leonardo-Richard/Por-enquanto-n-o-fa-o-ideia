import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperadmin } from "@/lib/authz";

/** Resultado testável sem `redirect` (SMEM-06). */
export type AdminPortalGateDecision = "allow" | "login" | "dashboard";

export function resolveAdminPortalGateFromSession(
  session: { user: { id: string; email?: string | null; name?: string | null; isSuperadmin?: boolean | null } } | null,
): AdminPortalGateDecision {
  if (!session?.user) {
    return "login";
  }
  if (!isSuperadmin(session.user)) {
    return "dashboard";
  }
  return "allow";
}

/**
 * FR101 — gate servidor `/admin/*`: sem sessão → login; autenticado sem superadmin → `/dashboard`.
 *
 * **SMEM-06 AC3:** em runtime, `redirect()` do Next.js produz **302** para o cliente. A árvore de
 * decisão é a mesma que {@link resolveAdminPortalGateFromSession} (testada em `admin-portal-gate.test.ts`);
 * equivalência formal para @architect / @qa + E2E em `e2e/superadmin-organizacoes-smoke.spec.ts`.
 */
export async function enforceAdminPortalGate(): Promise<void> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const decision = resolveAdminPortalGateFromSession(session);
  const nextPath = h.get("x-admin-pathname") ?? "/admin/organizacoes";
  if (decision === "login") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (decision === "dashboard") {
    redirect("/dashboard");
  }
}

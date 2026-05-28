import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type DashboardPortalGateDecision = "allow" | "login";

export function resolveDashboardPortalGateFromSession(
  session: { user: { id: string } } | null,
): DashboardPortalGateDecision {
  if (!session?.user) {
    return "login";
  }
  return "allow";
}

/**
 * Gate servidor para rotas `(dashboard)/*`: sem sessão → login com `next` preservado.
 */
export async function enforceDashboardPortalGate(): Promise<void> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const decision = resolveDashboardPortalGateFromSession(session);
  if (decision === "login") {
    const pathname = h.get("x-dashboard-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
}

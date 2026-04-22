"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAppSession } from "@/context/app-session";

const ALLOW_NO_ACTIVE = new Set(["/empresas", "/empresas/nova"]);

function hasWorkspaceContext(session: { activeCompanyId?: string | null; activeOrganizationId?: string | null }) {
  return Boolean(session.activeOrganizationId ?? session.activeCompanyId);
}

function needsActiveCompany(pathname: string): boolean {
  if (ALLOW_NO_ACTIVE.has(pathname)) {
    return false;
  }
  if (pathname.startsWith("/empresas/") && pathname.endsWith("/usuarios")) {
    return false;
  }
  return true;
}

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isPending, refetch } = useAppSession();

  useEffect(() => {
    void refetch(true);
  }, [pathname, refetch]);

  useEffect(() => {
    if (isPending || !data?.user) {
      return;
    }
    if (!needsActiveCompany(pathname)) {
      return;
    }
    if (!hasWorkspaceContext(data.session)) {
      const qs = searchParams.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(`/empresas?next=${encodeURIComponent(next)}`);
    }
  }, [isPending, data, pathname, router, searchParams]);

  if (isPending || !data?.user) {
    return null;
  }

  if (needsActiveCompany(pathname) && !hasWorkspaceContext(data.session)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-black/60 dark:text-white/55">
        A preparar contexto da organização…
      </div>
    );
  }

  return children;
}

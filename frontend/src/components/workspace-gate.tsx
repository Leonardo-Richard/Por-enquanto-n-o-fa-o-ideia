"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { useAppSession } from "@/context/app-session";

const ALLOW_NO_ACTIVE = new Set(["/empresas", "/empresas/nova"]);

function hasWorkspaceContext(session: { activeCompanyId?: string | null; activeOrganizationId?: string | null }) {
  return Boolean(session.activeOrganizationId ?? session.activeCompanyId);
}

function needsActiveCompany(pathname: string): boolean {
  if (pathname.startsWith("/admin")) {
    return false;
  }
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
    return <DashboardSkeleton />;
  }

  if (needsActiveCompany(pathname) && !hasWorkspaceContext(data.session)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--background)]"
        aria-busy="true"
        aria-label="A preparar contexto da organização"
      >
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-black/[0.08] dark:bg-white/[0.1]" />
          <p className="text-sm text-black/60 dark:text-white/55">
            A preparar contexto da organização…
          </p>
        </div>
      </div>
    );
  }

  return children;
}

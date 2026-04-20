"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePortal } from "@/context/portal-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { hydrated, user } = usePortal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hydrated && !user) {
      const qs = searchParams.toString();
      const full = qs ? `${pathname}?${qs}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(full)}`);
    }
  }, [hydrated, user, router, pathname, searchParams]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-black/60 dark:text-white/55">
        Carregando…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}

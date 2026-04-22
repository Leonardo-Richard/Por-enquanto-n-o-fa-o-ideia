"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAppSession } from "@/context/app-session";

export function SessionAuthGate({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useAppSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isPending) {
      return;
    }
    if (!data?.user) {
      const qs = searchParams.toString();
      const full = qs ? `${pathname}?${qs}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(full)}`);
    }
  }, [isPending, data?.user, router, pathname, searchParams]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-black/60 dark:text-white/55">
        Carregando…
      </div>
    );
  }

  if (!data?.user) {
    return null;
  }

  return children;
}

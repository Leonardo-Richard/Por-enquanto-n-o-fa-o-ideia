"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold">Algo correu mal</h1>
      <p className="max-w-md text-sm text-black/65 dark:text-white/60">
        Não foi possível carregar esta área do portal. Pode tentar novamente ou voltar ao painel.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
        >
          Tentar novamente
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
        >
          Ir ao painel
        </a>
      </div>
    </div>
  );
}

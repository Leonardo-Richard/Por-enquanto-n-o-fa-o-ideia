export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--background)]" aria-busy="true" aria-label="A carregar painel">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-black/5 bg-black/[0.02] py-6 dark:border-white/10 md:block">
          <div className="space-y-3 px-5">
            <div className="h-4 w-24 animate-pulse rounded bg-black/[0.08] dark:bg-white/[0.1]" />
            <div className="h-3 w-32 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
          </div>
          <div className="mt-8 space-y-2 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]"
              />
            ))}
          </div>
        </aside>
        <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-black/[0.08] dark:bg-white/[0.1]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-black/5 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]"
              />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-xl border border-black/5 dark:border-white/10" />
        </main>
      </div>
    </div>
  );
}

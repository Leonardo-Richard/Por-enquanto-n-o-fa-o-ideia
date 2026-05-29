export function PageLoadingSkeleton({ label = "A carregar" }: { label?: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={label}>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-black/[0.08] dark:bg-white/[0.1]" />
      <div className="h-4 w-full max-w-md animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
      <div className="space-y-3 rounded-xl border border-black/5 p-6 dark:border-white/10">
        <div className="h-4 w-32 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
      </div>
    </div>
  );
}

export function TableLoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="A carregar lista">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg border border-black/5 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.05]"
        />
      ))}
    </div>
  );
}

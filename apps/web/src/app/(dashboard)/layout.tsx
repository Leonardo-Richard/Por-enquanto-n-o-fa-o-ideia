import { Suspense } from "react";
import { AuthGate } from "@/components/auth-gate";
import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-black/60 dark:text-white/55">
          Carregando…
        </div>
      }
    >
      <AuthGate>
        <DashboardShell>{children}</DashboardShell>
      </AuthGate>
    </Suspense>
  );
}

import { Suspense } from "react";
import { SessionAuthGate } from "@/components/session-auth-gate";
import { WorkspaceGate } from "@/components/workspace-gate";
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
      <SessionAuthGate>
        <WorkspaceGate>
          <DashboardShell>{children}</DashboardShell>
        </WorkspaceGate>
      </SessionAuthGate>
    </Suspense>
  );
}

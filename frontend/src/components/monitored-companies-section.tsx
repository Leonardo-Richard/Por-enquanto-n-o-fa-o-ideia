"use client";

import Link from "next/link";
import { MonitoredCompanyRow } from "@/components/monitored-company-row";
import type { MonitoredCompaniesQuery } from "@/hooks/use-monitored-companies";

export type MonitoredCompaniesSectionProps = {
  /** Quando false, o título fica ao nível da página (ex.: h1 em `/empresas-monitoradas`). */
  showSectionHeading?: boolean;
  /** Uma instância de `useMonitoredCompanies` por página (evita dois GET no Painel). */
  query: MonitoredCompaniesQuery;
  /** Org activa na sessão — para NFR29 / AC9 e coerência com o GET da lista. */
  effectiveOrganizationId: string | null | undefined;
};

export function MonitoredCompaniesSection({
  showSectionHeading = true,
  query,
  effectiveOrganizationId,
}: MonitoredCompaniesSectionProps) {
  const { companies, loading, issue, reload } = query;

  const list = companies ?? [];

  return (
    <section
      className="rounded-xl border border-black/5 p-6 dark:border-white/10"
      aria-busy={loading ? true : undefined}
    >
      {showSectionHeading ? (
        <>
          <h2 className="text-base font-semibold tracking-tight">Empresas monitoradas</h2>
          <p className="mt-1 text-xs text-black/55 dark:text-white/50">
            CNPJs da organização ativa; edite a ficha ou solicite sincronização ADN quando disponível.
          </p>
        </>
      ) : null}
      <div className={showSectionHeading ? "mt-4" : ""}>
        {loading ? (
          <div className="w-full space-y-2">
            <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="h-9 w-48 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
          </div>
        ) : issue ? (
          <div role="alert" className="w-full text-sm text-red-700 dark:text-red-300">
            <p>{issue.message}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 rounded-lg border border-red-300/60 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-950/40"
            >
              Tentar novamente
            </button>
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-black/55 dark:text-white/50">
            Ainda não há CNPJs monitorados.{" "}
            <Link href="/empresas/nova" className="font-medium text-emerald-700 dark:text-emerald-400">
              Nova empresa monitorada
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {list.map((c) => (
              <MonitoredCompanyRow
                key={c.id}
                company={c}
                effectiveOrganizationId={effectiveOrganizationId}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

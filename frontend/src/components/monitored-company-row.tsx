"use client";

import Link from "next/link";
import { useAdnSyncForCompany } from "@/hooks/use-adn-sync-for-company";
import type { MonitoredCompanyRow } from "@/hooks/use-monitored-companies";
import { shouldOfferAdnSyncForRow } from "@/lib/monitored-company-adn-guard";

export type MonitoredCompanyRowProps = {
  company: MonitoredCompanyRow;
  /** Mesmo valor que alimenta `useMonitoredCompanies` (NFR29 / AC9). */
  effectiveOrganizationId: string | null | undefined;
};

export function MonitoredCompanyRow({ company, effectiveOrganizationId }: MonitoredCompanyRowProps) {
  const orgMatches = shouldOfferAdnSyncForRow(effectiveOrganizationId, company.organizationId);

  if (!orgMatches) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[MonitoredCompanyRow] organizationId da linha difere da org activa — acções ADN omitidas.",
        { companyId: company.id, rowOrg: company.organizationId, activeOrg: effectiveOrganizationId },
      );
    }
    return <MonitoredCompanyRowBody company={company} />;
  }

  return <MonitoredCompanyRowWithAdn company={company} />;
}

function MonitoredCompanyRowWithAdn({ company }: { company: MonitoredCompanyRow }) {
  const adn = useAdnSyncForCompany({
    companyId: company.id,
    organizationId: company.organizationId,
  });
  return <MonitoredCompanyRowBody company={company} adn={adn} />;
}

type AdnState = ReturnType<typeof useAdnSyncForCompany>;

function MonitoredCompanyRowBody({
  company,
  adn,
}: {
  company: MonitoredCompanyRow;
  adn?: AdnState;
}) {
  const editAriaLabel = `Editar empresa ${company.tradeName} (${company.cnpjMasked})`;

  return (
    <li className="flex flex-col gap-3 border-b border-black/5 py-4 last:border-b-0 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">{company.tradeName}</p>
        <p className="text-xs text-black/55 dark:text-white/50">
          <span className="font-mono">{company.systemCode}</span>
          <span className="mx-1.5 text-black/35 dark:text-white/35">·</span>
          <span>{company.cnpjMasked}</span>
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:min-w-[12rem] sm:items-end">
        <Link
          href={`/empresas/${company.id}`}
          className="inline-flex w-fit rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.04]"
          aria-label={editAriaLabel}
        >
          Editar
        </Link>
        {adn ? <MonitoredCompanyAdnRowActions adn={adn} /> : null}
      </div>
    </li>
  );
}

function MonitoredCompanyAdnRowActions({ adn }: { adn: AdnState }) {
  const { access, lastJob, busy, actionMsg, actionTone, refresh, requestSync } = adn;

  return (
    <div className="flex w-full max-w-md flex-col gap-2 sm:items-end">
      {access === "loading" ? (
        <p className="text-xs text-black/50 dark:text-white/45">A carregar estado ADN…</p>
      ) : null}

      {access === "feature_off" ? (
        <p className="text-xs text-amber-800 dark:text-amber-200" role="status">
          ADN não activo para esta organização.
        </p>
      ) : null}

      {access === "forbidden" ? (
        <p className="text-xs text-amber-800 dark:text-amber-200" role="status">
          Sem permissão para ADN nesta empresa.
        </p>
      ) : null}

      {access === "error" ? (
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <p className="text-xs text-red-800 dark:text-red-300" role="alert">
            Não foi possível carregar o estado ADN.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/15"
          >
            Actualizar
          </button>
        </div>
      ) : null}

      {access === "active" ? (
        <>
          <div className="text-xs text-black/60 dark:text-white/55" aria-live="polite">
            {lastJob ? (
              <span>
                ADN: <span className="font-mono">{lastJob.status}</span>
              </span>
            ) : (
              <span>Sem jobs ADN recentes.</span>
            )}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestSync()}
            className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-50"
          >
            Pedir sincronização ADN
          </button>
        </>
      ) : null}

      {actionMsg ? (
        <p
          className={
            actionTone === "success"
              ? "text-xs text-emerald-800 dark:text-emerald-300"
              : "text-xs text-amber-900 dark:text-amber-200"
          }
          aria-live="polite"
          role={actionTone === "success" ? "status" : "alert"}
        >
          {actionMsg}
        </p>
      ) : null}
    </div>
  );
}

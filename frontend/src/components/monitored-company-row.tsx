"use client";

import Link from "next/link";
import type { AdnExecutionsOverviewLastJob } from "@repo/shared";
import type { MonitoredCompanyRow } from "@/hooks/use-monitored-companies";
import {
  adnJobStatusBadgeClass,
  adnJobStatusLabel,
  formatAdnJobRelativeTime,
} from "@/lib/adn-executions-display";

export type MonitoredCompanyRowProps = {
  company: MonitoredCompanyRow;
  /** Último job da org (overview) — sem GET /adn/sync por linha. */
  lastJobOverview?: AdnExecutionsOverviewLastJob;
};

export function MonitoredCompanyRow({ company, lastJobOverview }: MonitoredCompanyRowProps) {
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
        {lastJobOverview ? (
          <p className="text-xs text-black/60 dark:text-white/55" aria-live="polite">
            <span
              className={`mr-2 inline-flex rounded-full px-2 py-0.5 font-medium ${adnJobStatusBadgeClass(
                lastJobOverview.status,
              )}`}
            >
              {adnJobStatusLabel(lastJobOverview.status)}
            </span>
            <span className="text-black/50 dark:text-white/45">
              {formatAdnJobRelativeTime(lastJobOverview.updatedAt)}
            </span>
            {lastJobOverview.detailLabel && lastJobOverview.detailLabel !== "—" ? (
              <span className="mt-1 block text-black/45 dark:text-white/40">
                {lastJobOverview.detailLabel}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-xs text-black/50 dark:text-white/45">Sem jobs ADN recentes.</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:min-w-[12rem] sm:items-end">
        <Link
          href={`/empresas/${company.id}`}
          className="inline-flex w-fit rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.04]"
          aria-label={editAriaLabel}
        >
          Ver ficha
        </Link>
        <Link
          href={`/empresas/${company.id}#adn`}
          className="inline-flex w-fit text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Sincronizar na ficha →
        </Link>
      </div>
    </li>
  );
}

"use client";

import Link from "next/link";
import { MonitoredCompaniesSection } from "@/components/monitored-companies-section";
import { useAdnExecutionsOverview } from "@/hooks/use-adn-executions-overview";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { useMonitoredCompanies } from "@/hooks/use-monitored-companies";

export default function EmpresasMonitoradasPage() {
  const { effectiveOrganizationId } = useMeSummary();
  const monitoredQuery = useMonitoredCompanies(effectiveOrganizationId);
  const overview = useAdnExecutionsOverview(effectiveOrganizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas monitoradas</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Lista completa de CNPJs da organização activa. Para resumo e alertas, use o{" "}
          <Link href="/dashboard" className="font-medium text-emerald-700 dark:text-emerald-400">
            Painel
          </Link>
          .
        </p>
      </div>
      <MonitoredCompaniesSection
        showSectionHeading={false}
        query={monitoredQuery}
        effectiveOrganizationId={effectiveOrganizationId}
        adnLastJobsByCompanyId={overview.data?.lastJobByCompanyId}
      />
    </div>
  );
}

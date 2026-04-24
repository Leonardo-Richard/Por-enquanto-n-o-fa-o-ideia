"use client";

import { MonitoredCompaniesSection } from "@/components/monitored-companies-section";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { useMonitoredCompanies } from "@/hooks/use-monitored-companies";

export default function EmpresasMonitoradasPage() {
  const { effectiveOrganizationId } = useMeSummary();
  const monitoredQuery = useMonitoredCompanies(effectiveOrganizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas monitoradas</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          CNPJs incluídos na automação de notas desta organização.
        </p>
      </div>
      <MonitoredCompaniesSection showSectionHeading={false} query={monitoredQuery} />
    </div>
  );
}

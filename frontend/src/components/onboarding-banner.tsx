"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { useMonitoredCompanies } from "@/hooks/use-monitored-companies";
import { useOrganizationAdnSyncSettings } from "@/hooks/use-organization-adn-sync-settings";
import { useAdnExecutionsOverview } from "@/hooks/use-adn-executions-overview";

const STORAGE_KEY = "portal-nf.onboarding-banner.dismissed";

export function OnboardingBanner() {
  const { effectiveOrganizationId } = useMeSummary();
  const monitored = useMonitoredCompanies(effectiveOrganizationId);
  const orgSettings = useOrganizationAdnSyncSettings({
    organizationId: effectiveOrganizationId ?? "",
    fetchEnabled: Boolean(effectiveOrganizationId),
  });
  const overview = useAdnExecutionsOverview(effectiveOrganizationId);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    if (dismissed) {
      return;
    }
    const postRegister = sessionStorage.getItem("portal-nf.show-onboarding") === "1";
    const companyCount = monitored.companies?.length ?? 0;
    const adnOff = orgSettings.data && !orgSettings.data.adnSyncEnabled;
    const noCompanies = Boolean(effectiveOrganizationId) && !monitored.loading && companyCount === 0;
    setVisible(postRegister || noCompanies || Boolean(adnOff));
  }, [
    effectiveOrganizationId,
    monitored.companies?.length,
    monitored.loading,
    orgSettings.data,
  ]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    sessionStorage.removeItem("portal-nf.show-onboarding");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  const companyCount = monitored.companies?.length ?? 0;
  const adnEnabled = orgSettings.data?.adnSyncEnabled ?? false;
  const hasPath = Boolean(orgSettings.data?.localDownloadRoot?.trim());
  const queuedCount = overview.data?.counts?.queued ?? 0;

  const steps = [
    { label: "Organização activa", done: Boolean(effectiveOrganizationId) },
    { label: "Empresa monitorada", done: companyCount > 0 },
    { label: "ADN activo na org", done: adnEnabled },
    { label: "Pasta raiz no servidor", done: hasPath },
  ];

  return (
    <section
      className="rounded-xl border border-emerald-600/25 bg-emerald-600/[0.08] p-5 dark:bg-emerald-600/[0.1]"
      role="status"
      aria-labelledby="onboarding-banner-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="onboarding-banner-title" className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
            Configure a automação
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-950/85 dark:text-emerald-50/85">
            Siga os passos abaixo para colocar a recolha ADN a funcionar. Detalhes na página{" "}
            <Link href="/agente" className="font-medium underline-offset-2 hover:underline">
              Agente
            </Link>
            .
          </p>
          <ul className="mt-4 space-y-2">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2 text-sm text-emerald-950/90 dark:text-emerald-50/90">
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.done
                      ? "bg-emerald-700 text-white dark:bg-emerald-500"
                      : "border border-emerald-700/40 text-emerald-800 dark:border-emerald-400/50"
                  }`}
                  aria-hidden="true"
                >
                  {step.done ? "✓" : "·"}
                </span>
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
          {queuedCount > 0 ? (
            <p className="mt-3 text-xs text-emerald-900/80 dark:text-emerald-100/80">
              Há {queuedCount} job(s) na fila — confirme que o worker está a correr (
              <Link href="/execucoes" className="underline-offset-2 hover:underline">
                Execuções
              </Link>
              ).
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!effectiveOrganizationId ? (
              <Link
                href="/empresas"
                className="inline-flex rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-emerald-600"
              >
                Escolher organização
              </Link>
            ) : companyCount === 0 ? (
              <Link
                href="/empresas/nova"
                className="inline-flex rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-emerald-600"
              >
                Cadastrar empresa
              </Link>
            ) : null}
            {!adnEnabled ? (
              <Link
                href="/configuracoes"
                className="inline-flex rounded-lg border border-emerald-800/30 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-400/40 dark:text-emerald-100"
              >
                Activar ADN
              </Link>
            ) : null}
            <Link
              href="/agente"
              className="inline-flex rounded-lg border border-emerald-800/30 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-400/40 dark:text-emerald-100"
            >
              Ver agente
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-emerald-900/70 hover:underline dark:text-emerald-100/70"
          aria-label="Fechar banner de onboarding"
        >
          Fechar
        </button>
      </div>
    </section>
  );
}

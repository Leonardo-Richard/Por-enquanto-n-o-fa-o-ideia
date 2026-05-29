"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { useMonitoredCompanies } from "@/hooks/use-monitored-companies";
import { useOrganizationAdnSyncSettings } from "@/hooks/use-organization-adn-sync-settings";
import { useAdnExecutionsOverview } from "@/hooks/use-adn-executions-overview";
import { fetchAdnRecentJobs } from "@/lib/adn-recent-jobs-client";

type CheckItem = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
  href?: string;
};

export function AgenteReadinessChecklist() {
  const { effectiveOrganizationId } = useMeSummary();
  const monitored = useMonitoredCompanies(effectiveOrganizationId);
  const orgSettings = useOrganizationAdnSyncSettings({
    organizationId: effectiveOrganizationId ?? "",
    fetchEnabled: Boolean(effectiveOrganizationId),
  });
  const overview = useAdnExecutionsOverview(effectiveOrganizationId);
  const [staleQueued, setStaleQueued] = useState(false);

  useEffect(() => {
    if (!effectiveOrganizationId) {
      setStaleQueued(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchAdnRecentJobs(effectiveOrganizationId, { limit: 5 });
        if (cancelled) {
          return;
        }
        const now = Date.now();
        const oldQueued = res.jobs.some((j) => {
          if (j.status !== "queued") {
            return false;
          }
          const t = new Date(j.updatedAt).getTime();
          return now - t > 15 * 60 * 1000;
        });
        setStaleQueued(oldQueued);
      } catch {
        if (!cancelled) {
          setStaleQueued(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveOrganizationId, overview.data?.counts?.queued]);

  const loading = orgSettings.loading || monitored.loading;
  const companyCount = monitored.companies?.length ?? 0;
  const adnEnabled = orgSettings.data?.adnSyncEnabled ?? false;
  const hasPath = Boolean(orgSettings.data?.localDownloadRoot?.trim());
  const queuedCount = overview.data?.counts?.queued ?? 0;

  const items: CheckItem[] = [
    {
      id: "org",
      label: "Organização activa na sessão",
      done: Boolean(effectiveOrganizationId),
      hint: "Escolha em Empresas",
      href: "/empresas",
    },
    {
      id: "companies",
      label: "Pelo menos uma empresa monitorada",
      done: companyCount > 0,
      hint: "Cadastre um CNPJ",
      href: "/empresas/nova",
    },
    {
      id: "adn",
      label: "Sincronização ADN activa na organização",
      done: adnEnabled,
      hint: "Active em Configurações",
      href: "/configuracoes",
    },
    {
      id: "path",
      label: "Pasta raiz no servidor definida",
      done: hasPath,
      hint: "Opcional para espelho em disco",
      href: "/configuracoes",
    },
    {
      id: "worker",
      label: "Worker a processar a fila (sem jobs «queued» antigos)",
      done: !staleQueued && queuedCount === 0,
      hint:
        queuedCount > 0
          ? `${queuedCount} job(s) na fila — instale e execute o worker`
          : staleQueued
            ? "Jobs em «queued» há mais de 15 min — verifique o worker"
            : "Sem jobs presos na fila",
      href: "/execucoes",
    },
  ];

  return (
    <section className="rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
      <h2 className="text-sm font-semibold">Checklist de prontidão</h2>
      <p className="mt-2 text-xs text-black/55 dark:text-white/50">
        Estado derivado das definições e da fila ADN no portal. Não detecta o processo{" "}
        <code className="font-mono">poll_jobs.py</code> no PC — confirme manualmente no servidor Windows.
      </p>
      {loading ? (
        <p className="mt-4 text-xs text-black/50 dark:text-white/45" aria-busy="true">
          A carregar estado…
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  item.done
                    ? "bg-emerald-600 text-white"
                    : "border border-black/20 text-black/40 dark:border-white/25"
                }`}
                aria-hidden="true"
              >
                {item.done ? "✓" : "·"}
              </span>
              <div>
                <p className={item.done ? "text-black/80 dark:text-white/75" : "text-black/65 dark:text-white/60"}>
                  {item.label}
                </p>
                {item.hint && !item.done ? (
                  <p className="mt-0.5 text-xs text-black/50 dark:text-white/45">
                    {item.href ? (
                      <Link href={item.href} className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
                        {item.hint}
                      </Link>
                    ) : (
                      item.hint
                    )}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

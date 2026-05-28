"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExecutionsAttentionBanner } from "@/components/executions-attention-banner";
import { MonitoredCompaniesSection } from "@/components/monitored-companies-section";
import { usePortal } from "@/context/portal-provider";
import { useAdnExecutionsOverview } from "@/hooks/use-adn-executions-overview";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { useMonitoredCompanies } from "@/hooks/use-monitored-companies";
import {
  adnJobStatusBadgeClass,
  adnJobStatusLabel,
  formatAdnJobRelativeTime,
} from "@/lib/adn-executions-display";
import { adnJobDetailLabel } from "@/lib/adn-executions-display";
import { fetchAdnRecentJobs } from "@/lib/adn-recent-jobs-client";
import { executionTriggerLabel } from "@/lib/execution-display";

export default function DashboardPage() {
  const { settings } = usePortal();
  const { effectiveOrganizationId, loading: orgLoading } = useMeSummary();
  const monitoredQuery = useMonitoredCompanies(effectiveOrganizationId);
  const overview = useAdnExecutionsOverview(effectiveOrganizationId);
  const [serverMirrorPath, setServerMirrorPath] = useState<string | null | undefined>(undefined);
  const [latestJob, setLatestJob] = useState<{
    companyCnpjMasked: string;
    trigger: string;
    updatedAt: string;
    status: string;
    detailLabel: string;
  } | null>(null);

  useEffect(() => {
    if (!effectiveOrganizationId) {
      setServerMirrorPath(undefined);
      return;
    }
    if (orgLoading) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/v1/organizations/${effectiveOrganizationId}/adn-sync-settings`,
          { credentials: "include", cache: "no-store" },
        );
        if (!r.ok || cancelled) {
          if (!cancelled) {
            setServerMirrorPath(null);
          }
          return;
        }
        const j = (await r.json()) as { localDownloadRoot?: string | null };
        if (cancelled) {
          return;
        }
        const raw = j.localDownloadRoot;
        if (typeof raw === "string" && raw.trim().length > 0) {
          setServerMirrorPath(raw.trim());
        } else {
          setServerMirrorPath(null);
        }
      } catch {
        if (!cancelled) {
          setServerMirrorPath(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveOrganizationId, orgLoading]);

  useEffect(() => {
    if (!effectiveOrganizationId || orgLoading) {
      setLatestJob(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchAdnRecentJobs(effectiveOrganizationId, { limit: 1 });
        if (cancelled) {
          return;
        }
        const j = res.jobs[0];
        if (!j) {
          setLatestJob(null);
          return;
        }
        setLatestJob({
          companyCnpjMasked: j.companyCnpjMasked,
          trigger: j.trigger,
          updatedAt: j.updatedAt,
          status: j.status,
          detailLabel: adnJobDetailLabel({ status: j.status, summary: j.summary }),
        });
      } catch {
        if (!cancelled) {
          setLatestJob(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveOrganizationId, orgLoading, overview.data]);

  const list = monitoredQuery.companies ?? [];
  const counts = overview.data?.counts;
  const attention = overview.data?.attention;
  const totalJobs = counts
    ? counts.queued + counts.running + counts.failed + counts.completed + counts.partial
    : null;
  const successDenom = counts ? counts.completed + counts.partial + counts.failed : 0;
  const successRate =
    counts && successDenom > 0
      ? Math.round(((counts.completed + counts.partial) / successDenom) * 100)
      : null;

  const summaryCards = useMemo(
    () =>
      counts
        ? [
            { label: "Na fila", value: counts.queued, href: "/execucoes?status=queued" },
            { label: "Em execução", value: counts.running, href: "/execucoes?status=running" },
            {
              label: "Falhas (7 dias)",
              value: attention?.failedLast7d ?? 0,
              href: "/execucoes?status=failed",
            },
            {
              label: "Concluídas",
              value: counts.completed + counts.partial,
              href: "/execucoes?status=completed",
            },
          ]
        : [],
    [counts, attention?.failedLast7d],
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Visão geral das empresas monitoradas, pastas locais e execuções ADN da organização activa.
        </p>
      </div>

      {overview.error ? (
        <p className="text-sm text-red-800 dark:text-red-300" role="alert">
          {overview.error}{" "}
          <button type="button" className="underline" onClick={() => void overview.reload()}>
            Tentar novamente
          </button>
        </p>
      ) : null}

      {attention ? <ExecutionsAttentionBanner attention={attention} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
            Empresas monitoradas
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{list.length}</p>
          <Link
            href="/empresas/nova"
            className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Cadastrar empresa
          </Link>
        </div>
        {overview.loading && !counts ? (
          <div className="col-span-1 rounded-xl border border-black/5 p-5 dark:border-white/10 sm:col-span-3">
            <p className="text-sm text-black/55 dark:text-white/50">A carregar resumo de execuções…</p>
          </div>
        ) : (
          summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{card.value}</p>
              <Link
                href={card.href}
                className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Ver em Execuções
              </Link>
            </div>
          ))
        )}
      </div>

      {totalJobs != null ? (
        <p className="text-xs text-black/55 dark:text-white/50">
          Total de jobs registados: {totalJobs}
          {successRate != null ? ` · Taxa de conclusão (com resultado): ${successRate}%` : null}
        </p>
      ) : null}

      <MonitoredCompaniesSection
        query={monitoredQuery}
        effectiveOrganizationId={effectiveOrganizationId}
        adnLastJobsByCompanyId={overview.data?.lastJobByCompanyId}
      />

      <section className="rounded-xl border border-black/5 p-6 dark:border-white/10">
        <h2 className="text-sm font-semibold">Rotina mensal</h2>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Cada empresa tem um <strong className="font-medium">dia D</strong> (1–28) na ficha — a coleta
          automática ADN é enfileirada nesse dia civil, no fuso{" "}
          <strong className="font-medium">{settings.timezone}</strong>. Não é sempre o dia 1; configure
          por empresa conforme a sua operação.
        </p>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Na lista acima pode pedir sincronização manual (entra na fila no portal) ou abrir a ficha para
          certificado, motor de recolha e histórico.
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">Última execução</h2>
          <Link
            href="/execucoes"
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Ver todas
          </Link>
        </div>
        {latestJob ? (
          <div className="mt-3 rounded-xl border border-black/5 bg-black/[0.02] p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            <p className="font-medium text-[var(--foreground)]">
              {latestJob.companyCnpjMasked} ·{" "}
              <span className="text-black/60 dark:text-white/55">
                {executionTriggerLabel(latestJob.trigger)}
              </span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/50">
              <span>
                {new Date(latestJob.updatedAt).toLocaleString("pt-BR")} ·{" "}
                {formatAdnJobRelativeTime(latestJob.updatedAt)}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 font-medium ${adnJobStatusBadgeClass(
                  latestJob.status,
                )}`}
              >
                {adnJobStatusLabel(latestJob.status)}
              </span>
            </p>
            {latestJob.detailLabel && latestJob.detailLabel !== "—" ? (
              <p className="mt-2 text-xs leading-relaxed text-black/60 dark:text-white/55">
                {latestJob.detailLabel}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-black/55 dark:text-white/50">
            Nenhuma execução ADN nesta organização. Cadastre uma empresa ou abra{" "}
            <Link href="/execucoes" className="text-emerald-700 dark:text-emerald-400">
              Execuções
            </Link>
            .
          </p>
        )}
      </section>

      <section className="rounded-xl border border-dashed border-emerald-600/30 bg-emerald-600/[0.06] p-6 dark:bg-emerald-600/[0.08]">
        <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          Agente no computador
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/85 dark:text-emerald-50/85">
          O site orquestra cadastros e agendamentos. A{" "}
          <strong className="font-medium">gravação automática de XML e PDF</strong> no seu disco
          {serverMirrorPath ? (
            <>
              {" "}
              — por exemplo em{" "}
              <code className="rounded bg-black/10 px-1 font-mono text-xs dark:bg-white/10">
                {serverMirrorPath}
              </code>
            </>
          ) : null}{" "}
          ocorre na <strong className="font-medium">mesma máquina Windows</strong> onde está instalado o{" "}
          <strong className="font-medium">worker de recolha ADN</strong> (com o certificado). O caminho absoluto
          deve estar definido em{" "}
          <Link
            href="/configuracoes"
            className="font-medium underline-offset-2 hover:underline"
          >
            Configurações
          </Link>{" "}
          → <strong className="font-medium">Pasta raiz no disco (servidor)</strong>. Para arquivo noutro PC,
          será necessário o <strong className="font-medium">agente local</strong> (fase posterior).
        </p>
        {serverMirrorPath === undefined && effectiveOrganizationId ? (
          <p className="mt-2 text-xs text-emerald-900/70 dark:text-emerald-100/70">A carregar caminho do servidor…</p>
        ) : null}
      </section>
    </div>
  );
}

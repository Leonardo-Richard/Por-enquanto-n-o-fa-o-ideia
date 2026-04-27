"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { displayCnpjLabel } from "@repo/shared";
import { MonitoredCompaniesSection } from "@/components/monitored-companies-section";
import { usePortal } from "@/context/portal-provider";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { useMonitoredCompanies } from "@/hooks/use-monitored-companies";

export default function DashboardPage() {
  const { executions, settings } = usePortal();
  const { effectiveOrganizationId, loading: orgLoading } = useMeSummary();
  const monitoredQuery = useMonitoredCompanies(effectiveOrganizationId);
  const [serverMirrorPath, setServerMirrorPath] = useState<string | null | undefined>(undefined);

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

  const lastRun = executions[0];
  const successRate =
    executions.length === 0
      ? null
      : Math.round(
          (executions.filter((e) => e.status === "success").length /
            executions.length) *
            100,
        );

  const list = monitoredQuery.companies ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Visão geral das empresas monitoradas, pastas locais e últimas execuções da automação.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
            Empresas monitoradas
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {list.length}
          </p>
          <Link
            href="/empresas/nova"
            className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Cadastrar empresa
          </Link>
        </div>
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
            Execuções (total)
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {executions.length}
          </p>
          <p className="mt-3 text-xs text-black/55 dark:text-white/50">
            Inclui simulações locais até o agente desktop estar ligado.
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
            Taxa de sucesso
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {successRate === null ? "—" : `${successRate}%`}
          </p>
          <p className="mt-3 text-xs text-black/55 dark:text-white/50">
            Histórico neste navegador (persistido localmente).
          </p>
        </div>
      </div>

      <MonitoredCompaniesSection
        query={monitoredQuery}
        effectiveOrganizationId={effectiveOrganizationId}
      />

      <section className="rounded-xl border border-black/5 p-6 dark:border-white/10">
        <h2 className="text-sm font-semibold">Rotina mensal (dia 1º)</h2>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Em produção, cada empresa com agente ativo recebe uma coleta no dia 1º ({settings.timezone}). Na lista
          acima pode solicitar sincronização ADN (fila no portal) ou abrir a ficha da empresa para testes locais.
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
        {lastRun ? (
          <div className="mt-3 rounded-xl border border-black/5 bg-black/[0.02] p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            <p className="font-medium text-[var(--foreground)]">
              {displayCnpjLabel(lastRun.companyCnpjDigits)} ·{" "}
              <span className="text-black/60 dark:text-white/55">
                {triggerLabel(lastRun.trigger)}
              </span>
            </p>
            <p className="mt-1 text-xs text-black/55 dark:text-white/50">
              {new Date(lastRun.startedAt).toLocaleString("pt-BR")} ·{" "}
              {statusLabel(lastRun.status)}
            </p>
            {lastRun.detail ? (
              <p className="mt-2 text-xs leading-relaxed text-black/60 dark:text-white/55">
                {lastRun.detail}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-black/55 dark:text-white/50">
            Nenhuma execução ainda. Cadastre uma empresa ou abra{" "}
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

function triggerLabel(t: string) {
  if (t === "signup") {
    return "Pós-cadastro";
  }
  if (t === "monthly") {
    return "Agendada (dia 1º)";
  }
  return "Manual";
}

function statusLabel(s: string) {
  if (s === "running") {
    return "Em execução";
  }
  if (s === "failed") {
    return "Falhou";
  }
  return "Concluída";
}

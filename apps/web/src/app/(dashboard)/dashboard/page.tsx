"use client";

import Link from "next/link";
import { displayCnpjLabel } from "@repo/shared";
import { usePortal } from "@/context/portal-provider";
import { useAccessibleCompanies } from "@/hooks/use-accessible-companies";

export default function DashboardPage() {
  const { executions, settings, runSync } = usePortal();
  const { companies } = useAccessibleCompanies();

  const lastRun = executions[0];
  const successRate =
    executions.length === 0
      ? null
      : Math.round(
          (executions.filter((e) => e.status === "success").length /
            executions.length) *
            100,
        );

  const list = companies ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Visão geral das empresas, pastas locais e últimas execuções da
          automação.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
            Empresas
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

      <section className="rounded-xl border border-black/5 p-6 dark:border-white/10">
        <h2 className="text-sm font-semibold">Rotina mensal (dia 1º)</h2>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Em produção, cada empresa com agente ativo recebe uma coleta no dia 1º
          ({settings.timezone}). Aqui você pode disparar uma sincronização
          manual para testar o fluxo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {list.length === 0 ? (
            <p className="text-sm text-black/55 dark:text-white/50">
              Cadastre uma empresa para habilitar sincronizações.
            </p>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => runSync(c.id, "monthly", c.cnpjMasked)}
                className="rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-xs font-medium transition-colors hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.04]"
              >
                Job mensal · {c.cnpjMasked}
              </button>
            ))
          )}
        </div>
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
          O site orquestra cadastros e agendamentos; o download efetivo para{" "}
          <code className="rounded bg-black/10 px-1 font-mono text-xs dark:bg-white/10">
            {settings.localRootPath}
          </code>{" "}
          exige o componente local (Windows em prioridade). Configure o caminho
          em{" "}
          <Link
            href="/configuracoes"
            className="font-medium underline-offset-2 hover:underline"
          >
            Configurações
          </Link>
          .
        </p>
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

"use client";

import Link from "next/link";
import { displayCnpjLabel } from "@repo/shared";
import { usePortal } from "@/context/portal-provider";

export default function ExecucoesPage() {
  const { executions } = usePortal();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Histórico de coletas (simulado no navegador). Em produção, integra
          fila, worker e agente local com logs exportáveis.
        </p>
      </div>

      {executions.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/50">
          Nenhuma execução registrada.{" "}
          <Link href="/empresas/nova" className="text-emerald-700 dark:text-emerald-400">
            Cadastre uma empresa
          </Link>{" "}
          ou dispare uma sincronização no painel.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.03] text-xs font-medium uppercase tracking-wide text-black/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {executions.map((e) => (
                <tr key={e.id} className="bg-[var(--background)]">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-black/70 dark:text-white/65">
                    {new Date(e.startedAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {displayCnpjLabel(e.companyCnpjDigits)}
                  </td>
                  <td className="px-4 py-3 text-xs">{triggerLabel(e.trigger)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.status === "running"
                          ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                          : e.status === "failed"
                            ? "bg-red-500/15 text-red-800 dark:text-red-200"
                            : "bg-emerald-600/15 text-emerald-900 dark:text-emerald-100"
                      }`}
                    >
                      {statusLabel(e.status)}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-black/60 dark:text-white/55">
                    {e.detail ?? "—"}
                    {e.filesCount != null && e.status === "success" ? (
                      <span className="mt-1 block text-black/45 dark:text-white/45">
                        Arquivos: {e.filesCount}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

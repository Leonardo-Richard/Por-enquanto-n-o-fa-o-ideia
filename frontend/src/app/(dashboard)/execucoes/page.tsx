"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "@/context/app-session";
import {
  downloadEngineLabel,
  failureCategoryUserMessage,
} from "@/lib/adn-executions-display";
import { fetchAdnRecentJobs, type AdnRecentJobRow } from "@/lib/adn-recent-jobs-client";
import { executionTriggerLabel } from "@/lib/execution-display";

function jobStatusBadgeClass(status: string): string {
  if (status === "running" || status === "queued") {
    return "bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  if (status === "failed") {
    return "bg-red-500/15 text-red-800 dark:text-red-200";
  }
  return "bg-emerald-600/15 text-emerald-900 dark:text-emerald-100";
}

function jobStatusLabel(status: string): string {
  if (status === "running") {
    return "Em execução";
  }
  if (status === "queued") {
    return "Na fila";
  }
  if (status === "failed") {
    return "Falhou";
  }
  if (status === "partial") {
    return "Parcial";
  }
  return "Concluída";
}

function summaryDownloadEngine(summary: Record<string, unknown> | null): string | undefined {
  if (!summary || typeof summary !== "object") {
    return undefined;
  }
  const de = summary.downloadEngine;
  return typeof de === "string" ? de : undefined;
}

function summaryFailureCategory(summary: Record<string, unknown> | null): string | undefined {
  if (!summary || typeof summary !== "object") {
    return undefined;
  }
  const fc = summary.failureCategory;
  return typeof fc === "string" ? fc : undefined;
}

function detailPrimary(job: AdnRecentJobRow): string {
  const s = job.summary;
  if (job.status === "failed") {
    const cat = summaryFailureCategory(s);
    const friendly = failureCategoryUserMessage(cat);
    if (friendly) {
      return friendly;
    }
    return "Não foi possível concluir a operação.";
  }
  if (job.status === "completed" || job.status === "partial") {
    const ax = typeof s?.artifactsXml === "number" ? s.artifactsXml : null;
    const ap = typeof s?.artifactsPdf === "number" ? s.artifactsPdf : null;
    if (ax != null || ap != null) {
      const parts: string[] = [];
      if (ax != null) {
        parts.push(`${ax} XML`);
      }
      if (ap != null) {
        parts.push(`${ap} PDF`);
      }
      return parts.join(", ");
    }
  }
  return "—";
}

function liveRegionMessage(
  loadState: "idle" | "loading" | "error" | "ok",
  jobsLen: number,
): string {
  if (loadState === "loading") {
    return "A carregar execuções.";
  }
  if (loadState === "error") {
    return "Erro ao carregar execuções.";
  }
  if (loadState === "ok") {
    return `${jobsLen} execução${jobsLen === 1 ? "" : "ões"} carregada${jobsLen === 1 ? "" : "s"}.`;
  }
  return "";
}

export default function ExecucoesPage() {
  const { data: sessionData, isPending: sessionPending } = useAppSession();
  const activeOrgId = sessionData?.session.activeOrganizationId ?? null;

  const [jobs, setJobs] = useState<AdnRecentJobRow[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrgId) {
      return;
    }
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await fetchAdnRecentJobs(activeOrgId, { limit: 50 });
      setJobs(res.jobs);
      setLoadState("ok");
    } catch (e) {
      setLoadState("error");
      setLoadError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId || sessionPending) {
      return;
    }
    void load();
  }, [activeOrgId, sessionPending, load]);

  if (sessionPending) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
        <p className="text-sm text-black/55 dark:text-white/50">A carregar…</p>
      </div>
    );
  }

  if (!activeOrgId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
          <p className="mt-2 text-sm text-black/65 dark:text-white/60">
            Seleccione uma organização no painel para ver o histórico de sincronizações ADN de todas as
            empresas monitoradas.
          </p>
        </div>
        <p className="text-sm text-black/55 dark:text-white/50">
          Use{" "}
          <Link href="/configuracoes" className="text-emerald-700 dark:text-emerald-400">
            Configurações
          </Link>{" "}
          ou o selector de organização no topo para definir o contexto activo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Histórico de jobs ADN da organização (todas as empresas monitoradas).
        </p>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveRegionMessage(loadState, jobs.length)}
      </p>

      {loadState === "loading" ? (
        <p className="text-sm text-black/55 dark:text-white/50" aria-hidden="true">
          A carregar execuções…
        </p>
      ) : null}

      {loadState === "error" ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-900 dark:text-red-100">
          {loadError ?? "Não foi possível carregar."}{" "}
          <button
            type="button"
            className="underline decoration-red-500/50 underline-offset-2"
            onClick={() => void load()}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {loadState === "ok" && jobs.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/50">
          Nenhuma execução registada nesta organização. Dispare uma sincronização na ficha de uma empresa
          monitorada.
        </p>
      ) : null}

      {loadState === "ok" && jobs.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.03] text-xs font-medium uppercase tracking-wide text-black/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Empresa (CNPJ)</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {jobs.map((job) => {
                const de = summaryDownloadEngine(job.summary);
                const motorLine = `Motor: ${downloadEngineLabel(de)}`;
                const primary = detailPrimary(job);
                const statusLbl = jobStatusLabel(job.status);
                return (
                  <tr key={job.id} className="bg-[var(--background)]">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-black/70 dark:text-white/65">
                      {new Date(job.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {job.companyCnpjMasked}
                    </td>
                    <td className="px-4 py-3 text-xs">{executionTriggerLabel(job.trigger)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${jobStatusBadgeClass(
                          job.status,
                        )}`}
                      >
                        {statusLbl}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-black/60 dark:text-white/55">
                      <details className="group">
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <span className="text-black/80 underline decoration-black/20 underline-offset-2 group-open:decoration-emerald-600/50 dark:text-white/70 dark:decoration-white/20">
                            {primary}
                          </span>
                          <span className="mt-0.5 block text-[10px] font-normal text-black/40 dark:text-white/35">
                            Expandir para ver o modo de recolha (motor)
                          </span>
                        </summary>
                        <div
                          className="mt-2 rounded-md border border-black/10 bg-black/[0.02] px-2 py-1.5 text-[11px] leading-snug text-black/55 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45"
                          aria-live="polite"
                        >
                          {motorLine}. Estado: {statusLbl}.
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

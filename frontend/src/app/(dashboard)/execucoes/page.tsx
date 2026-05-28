"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppSession } from "@/context/app-session";
import {
  adnJobDetailLabel,
  adnJobStatusBadgeClass,
  adnJobStatusLabel,
  downloadEngineLabel,
  isAdnJobInProgress,
} from "@/lib/adn-executions-display";
import { fetchAdnRecentJobs, type AdnRecentJobRow } from "@/lib/adn-recent-jobs-client";
import { executionTriggerLabel } from "@/lib/execution-display";

type StatusFilter =
  | "all"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "partial";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "queued", label: "Na fila" },
  { value: "running", label: "Em execução" },
  { value: "completed", label: "Concluída" },
  { value: "failed", label: "Falhou" },
  { value: "partial", label: "Parcial" },
];

function parseStatusFilter(raw: string | null): StatusFilter {
  if (
    raw === "queued" ||
    raw === "running" ||
    raw === "completed" ||
    raw === "failed" ||
    raw === "partial"
  ) {
    return raw;
  }
  return "all";
}

function jobMatchesFilter(job: AdnRecentJobRow, filter: StatusFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "completed") {
    return job.status === "completed" || job.status === "partial";
  }
  return job.status === filter;
}

function summaryDownloadEngine(summary: Record<string, unknown> | null): string | undefined {
  if (!summary || typeof summary !== "object") {
    return undefined;
  }
  const de = summary.downloadEngine;
  return typeof de === "string" ? de : undefined;
}

function liveRegionMessage(
  loadState: "idle" | "loading" | "error" | "ok",
  visibleLen: number,
): string {
  if (loadState === "loading") {
    return "A carregar execuções.";
  }
  if (loadState === "error") {
    return "Erro ao carregar execuções.";
  }
  if (loadState === "ok") {
    return `${visibleLen} execução${visibleLen === 1 ? "" : "ões"} visível${visibleLen === 1 ? "" : "s"}.`;
  }
  return "";
}

export default function ExecucoesPage() {
  const searchParams = useSearchParams();
  const { data: sessionData, isPending: sessionPending } = useAppSession();
  const activeOrgId = sessionData?.session.activeOrganizationId ?? null;

  const [jobs, setJobs] = useState<AdnRecentJobRow[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseStatusFilter(searchParams.get("status")),
  );
  const [cnpjSearch, setCnpjSearch] = useState("");

  useEffect(() => {
    setStatusFilter(parseStatusFilter(searchParams.get("status")));
  }, [searchParams]);

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

  const hasInProgress = useMemo(
    () => jobs.some((j) => isAdnJobInProgress(j.status)),
    [jobs],
  );

  useEffect(() => {
    if (!activeOrgId || !hasInProgress || loadState !== "ok") {
      return;
    }
    const id = setInterval(() => {
      void load();
    }, 30_000);
    return () => clearInterval(id);
  }, [activeOrgId, hasInProgress, loadState, load]);

  const filteredJobs = useMemo(() => {
    const q = cnpjSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (!jobMatchesFilter(job, statusFilter)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return job.companyCnpjMasked.toLowerCase().includes(q);
    });
  }, [jobs, statusFilter, cnpjSearch]);

  const setFilterAndUrl = (next: StatusFilter) => {
    setStatusFilter(next);
    const url = new URL(window.location.href);
    if (next === "all") {
      url.searchParams.delete("status");
    } else {
      url.searchParams.set("status", next);
    }
    window.history.replaceState(null, "", url.pathname + url.search);
  };

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
          <p className="mt-2 text-sm text-black/65 dark:text-white/60">
            Histórico de jobs ADN da organização (todas as empresas monitoradas).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loadState === "loading"}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.04]"
        >
          Actualizar
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label htmlFor="exec-status-filter" className="block text-xs font-medium text-black/55 dark:text-white/50">
            Estado
          </label>
          <select
            id="exec-status-filter"
            value={statusFilter}
            onChange={(e) => setFilterAndUrl(e.target.value as StatusFilter)}
            className="mt-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1 sm:max-w-xs">
          <label htmlFor="exec-cnpj-search" className="block text-xs font-medium text-black/55 dark:text-white/50">
            Pesquisar CNPJ
          </label>
          <input
            id="exec-cnpj-search"
            type="search"
            value={cnpjSearch}
            onChange={(e) => setCnpjSearch(e.target.value)}
            placeholder="Máscara do CNPJ"
            className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
      </div>

      {hasInProgress ? (
        <p className="text-xs text-black/55 dark:text-white/50" role="status">
          Há jobs na fila ou em execução — a lista actualiza automaticamente a cada 30 segundos.
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveRegionMessage(loadState, filteredJobs.length)}
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

      {loadState === "ok" && jobs.length > 0 && filteredJobs.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/50">
          Nenhuma execução corresponde aos filtros actuais.
        </p>
      ) : null}

      {loadState === "ok" && filteredJobs.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.03] text-xs font-medium uppercase tracking-wide text-black/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Empresa (CNPJ)</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Detalhe</th>
                <th className="px-4 py-3">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {filteredJobs.map((job) => {
                const de = summaryDownloadEngine(job.summary);
                const motorLine = `Motor: ${downloadEngineLabel(de)}`;
                const primary = adnJobDetailLabel(job);
                const statusLbl = adnJobStatusLabel(job.status);
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
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${adnJobStatusBadgeClass(
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
                    <td className="px-4 py-3 text-xs">
                      <Link
                        href={`/empresas/${job.companyId}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Ver empresa
                      </Link>
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

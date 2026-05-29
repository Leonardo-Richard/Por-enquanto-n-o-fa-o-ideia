"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type MetricsJson = {
  schemaVersion?: string;
  partial?: boolean;
  windowMinutes?: number;
  windowLabel?: string;
  adn?: Record<string, unknown>;
  certificate?: Record<string, unknown>;
  generatedAt?: string;
};

type AlertsJson = {
  schemaVersion?: string;
  partial?: boolean;
  windowMinutes?: number;
  activeOnly?: boolean;
  alerts?: unknown[];
  generatedAt?: string;
};

function OpsDataPanel({
  title,
  data,
  partial,
}: {
  title: string;
  data: Record<string, unknown> | null;
  partial: boolean;
}) {
  const [showRaw, setShowRaw] = useState(false);

  if (!data) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-black/5 p-4 dark:border-white/10">
      <h2 className="text-sm font-semibold">{title}</h2>
      {partial ? (
        <div
          className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/[0.06] p-4 dark:bg-amber-500/[0.08]"
          role="status"
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-50">Em construção</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-950/85 dark:text-amber-50/85">
            Os indicadores agregados (fila ADN, falhas 7 dias, certificados) serão mostrados aqui quando
            a instrumentação backend estiver ligada. Enquanto isso, use{" "}
            <Link href="/execucoes" className="font-medium underline-offset-2 hover:underline">
              Execuções
            </Link>{" "}
            e a ficha de cada empresa para operação diária.
          </p>
          <p className="mt-2 text-xs text-amber-950/70 dark:text-amber-50/70">
            Documentação:{" "}
            <code className="rounded bg-black/10 px-1 font-mono text-[10px] dark:bg-white/10">
              docs/qa/ops-alerts-runbook.md
            </code>
          </p>
        </div>
      ) : (
        <p className="text-xs text-black/55 dark:text-white/50">
          Dados agregados disponíveis para a janela seleccionada.
        </p>
      )}
      <button
        type="button"
        className="text-xs font-medium text-emerald-800 underline decoration-emerald-800/40 underline-offset-2 dark:text-emerald-300"
        aria-expanded={showRaw}
        onClick={() => setShowRaw((v) => !v)}
      >
        {showRaw ? "Ocultar resposta técnica" : "Ver resposta técnica (JSON)"}
      </button>
      {showRaw ? (
        <pre className="max-h-96 overflow-auto rounded-lg bg-black/[0.03] p-3 text-xs dark:bg-white/[0.05]">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

export function AdminOpsDashboard() {
  const formId = useId();
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [metrics, setMetrics] = useState<MetricsJson | null>(null);
  const [alerts, setAlerts] = useState<AlertsJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setIssue(null);
    try {
      const q = new URLSearchParams({ windowMinutes: String(windowMinutes) });
      const [m, a] = await Promise.all([
        apiFetch(`/api/v1/ops/metrics?${q}`, { credentials: "include", cache: "no-store" }),
        apiFetch(`/api/v1/ops/alerts?${q}&active=1`, { credentials: "include", cache: "no-store" }),
      ]);
      if (m.status === 401 || a.status === 401) {
        setIssue("Sessão inválida.");
        return;
      }
      if (m.status === 403 || a.status === 403) {
        setIssue("Sem permissão (requer superadmin).");
        return;
      }
      if (!m.ok || !a.ok) {
        setIssue("Não foi possível carregar os dados operacionais.");
        return;
      }
      setMetrics((await m.json()) as MetricsJson);
      setAlerts((await a.json()) as AlertsJson);
    } catch {
      setIssue("Erro de rede ao carregar operações.");
    } finally {
      setLoading(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <nav className="text-xs text-black/55 dark:text-white/50" aria-label="Contexto">
        <Link href="/admin/organizacoes" className="text-emerald-800 underline dark:text-emerald-300">
          Organizações
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-black/70 dark:text-white/65">Operação</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Operação</h1>
        <p className="text-sm text-black/65 dark:text-white/60">
          Vista operacional para superadmin. Métricas e alertas agregados dependem de instrumentação no
          backend (MSYS-07).
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label htmlFor={formId} className="text-xs font-medium text-black/70 dark:text-white/65">
            Janela (minutos)
          </label>
          <input
            id={formId}
            type="number"
            min={5}
            max={1440}
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(Number(e.target.value) || 60)}
            className="w-32 rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
          className="h-10 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      {issue ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-100" role="alert">
          {issue}
        </div>
      ) : null}

      {loading && !metrics ? (
        <div className="h-40 animate-pulse rounded-xl border border-black/5 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06]" aria-busy="true" />
      ) : null}

      {metrics ? (
        <OpsDataPanel title="Métricas" data={metrics as Record<string, unknown>} partial={metrics.partial !== false} />
      ) : null}

      {alerts ? (
        <OpsDataPanel title="Alertas" data={alerts as Record<string, unknown>} partial={alerts.partial !== false} />
      ) : null}
    </div>
  );
}

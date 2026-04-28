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
        <h1 className="text-2xl font-semibold tracking-tight">Operação (MVP)</h1>
        <p className="text-sm text-black/65 dark:text-white/60">
          Vista mínima dos endpoints <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">/api/v1/ops/metrics</code> e{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">/api/v1/ops/alerts</code>. Indicadores numéricos serão preenchidos quando a
          fonte agregada estiver ligada.
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
        <section className="space-y-2 rounded-xl border border-black/5 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">Métricas</h2>
          <pre className="max-h-96 overflow-auto rounded-lg bg-black/[0.03] p-3 text-xs dark:bg-white/[0.05]">
            {JSON.stringify(metrics, null, 2)}
          </pre>
        </section>
      ) : null}

      {alerts ? (
        <section className="space-y-2 rounded-xl border border-black/5 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">Alertas</h2>
          <pre className="max-h-96 overflow-auto rounded-lg bg-black/[0.03] p-3 text-xs dark:bg-white/[0.05]">
            {JSON.stringify(alerts, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useConfirmDialog } from "@/context/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

type AdnFailureRow = {
  id: string;
  attemptedAt: string;
  errorCode: string;
  userMessage: string;
  canRetry: boolean;
  kind: string | null;
};

type AdnFailuresPanelProps = {
  organizationId: string;
  companyId: string;
  /** Só mostra acções de reprocessar quando o utilizador é admin da org. */
  canManage: boolean;
  refreshSignal?: number;
};

export function AdnFailuresPanel({
  organizationId,
  companyId,
  canManage,
  refreshSignal = 0,
}: AdnFailuresPanelProps) {
  const liveId = useId();
  const { confirm } = useConfirmDialog();
  const [items, setItems] = useState<AdnFailureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/failures`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setItems([]);
        setError("Não foi possível carregar falhas de ingestão.");
        return;
      }
      const body = (await res.json()) as { items?: AdnFailureRow[] };
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch {
      setItems([]);
      setError("Erro de rede ao carregar falhas.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, companyId]);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  async function retryOne(failure: AdnFailureRow) {
    const ok = await confirm({
      title: "Reprocessar falha?",
      description: `Reprocessar esta falha (${failure.errorCode})? O pedido será enfileirado novamente quando o worker estiver activo.`,
      confirmLabel: "Reprocessar",
    });
    if (!ok) {
      return;
    }
    setBusyId(failure.id);
    setActionMsg(null);
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/failures/${failure.id}/retry`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setActionMsg(body?.message ?? "Não foi possível pedir reprocessamento.");
        return;
      }
      setActionMsg(body?.message ?? "Reprocessamento pedido.");
      await load();
    } catch {
      setActionMsg("Erro de rede ao pedir reprocessamento.");
    } finally {
      setBusyId(null);
    }
  }

  async function retryBulk() {
    const retryable = items.filter((i) => i.canRetry);
    if (retryable.length === 0) {
      return;
    }
    const ok = await confirm({
      title: "Reprocessar em lote?",
      description: `Reprocessar ${retryable.length} falha(s) em lote? Os pedidos serão enfileirados novamente.`,
      confirmLabel: "Reprocessar em lote",
    });
    if (!ok) {
      return;
    }
    setBulkBusy(true);
    setActionMsg(null);
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/failures/retry-bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ failureIds: retryable.map((i) => i.id) }),
        },
      );
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setActionMsg(body?.message ?? "Não foi possível pedir reprocessamento em lote.");
        return;
      }
      setActionMsg(body?.message ?? "Reprocessamento em lote aceite.");
      await load();
    } catch {
      setActionMsg("Erro de rede ao pedir reprocessamento em lote.");
    } finally {
      setBulkBusy(false);
    }
  }

  const retryableCount = items.filter((i) => i.canRetry).length;

  return (
    <div
      className="mt-6 rounded-lg border border-black/8 bg-black/[0.02] p-4 dark:border-white/12 dark:bg-white/[0.02]"
      aria-labelledby={`${liveId}-failures-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${liveId}-failures-title`} className="text-sm font-semibold">
            Falhas de ingestão
          </h3>
          <p className="mt-1 text-xs text-black/55 dark:text-white/50">
            Documentos que o worker não conseguiu processar. Reprocessar só quando a causa estiver
            corrigida (certificado, rede, etc.).
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-xs dark:border-white/15"
        >
          Actualizar
        </button>
      </div>

      <div className="mt-3" aria-live="polite" aria-busy={loading ? true : undefined}>
        {loading ? (
          <p className="text-xs text-black/50 dark:text-white/45">A carregar falhas…</p>
        ) : error ? (
          <p className="text-xs text-red-800 dark:text-red-300" role="alert">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              Tentar novamente
            </button>
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-black/55 dark:text-white/50" role="status">
            Sem falhas pendentes de ingestão para esta empresa.
          </p>
        ) : (
          <>
            {canManage && retryableCount > 1 ? (
              <button
                type="button"
                disabled={bulkBusy || busyId !== null}
                onClick={() => void retryBulk()}
                className="mb-3 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/15 disabled:opacity-50"
              >
                {bulkBusy ? "A pedir…" : `Reprocessar ${retryableCount} em lote`}
              </button>
            ) : null}
            <ul className="space-y-2">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-black/6 px-3 py-2 text-xs dark:border-white/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-black/80 dark:text-white/75">
                        {row.userMessage}
                      </p>
                      <p className="mt-0.5 text-black/50 dark:text-white/45">
                        <span className="font-mono">{row.errorCode}</span>
                        {row.kind ? (
                          <>
                            {" "}
                            · <span>{row.kind}</span>
                          </>
                        ) : null}
                        {" · "}
                        {new Date(row.attemptedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {canManage && row.canRetry ? (
                      <button
                        type="button"
                        disabled={busyId === row.id || bulkBusy}
                        onClick={() => void retryOne(row)}
                        className="shrink-0 rounded-lg bg-[var(--foreground)] px-2.5 py-1 text-[11px] font-medium text-[var(--background)] disabled:opacity-50"
                      >
                        {busyId === row.id ? "A pedir…" : "Reprocessar"}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {actionMsg ? (
        <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300" role="status">
          {actionMsg}
        </p>
      ) : null}
    </div>
  );
}

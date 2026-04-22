"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { Company } from "@repo/shared";

type LastJob = {
  id: string;
  status: string;
  trigger: string;
  summary: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type PanelAccess = "loading" | "active" | "feature_off" | "forbidden" | "error";

export function AdnSyncPanel({ company }: { company: Company }) {
  const liveId = useId();
  const [access, setAccess] = useState<PanelAccess>("loading");
  const [lastJob, setLastJob] = useState<LastJob | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/v1/organizations/${company.organizationId}/monitored-companies/${company.id}/adn`;

  const refresh = useCallback(async () => {
    setAccess("loading");
    setActionMsg(null);
    const r = await fetch(`${base}/sync`, { credentials: "include" });
    if (r.status === 404) {
      setAccess("feature_off");
      setLastJob(null);
      return;
    }
    if (r.status === 403) {
      setAccess("forbidden");
      setLastJob(null);
      return;
    }
    if (!r.ok) {
      setAccess("error");
      setLastJob(null);
      return;
    }
    const b = (await r.json()) as { lastJob: LastJob | null };
    setAccess("active");
    setLastJob(b.lastJob);
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (access !== "active" || !lastJob || lastJob.status !== "running") {
      return;
    }
    const t = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(t);
  }, [access, lastJob, refresh]);

  async function requestSync() {
    if (!window.confirm("Pedir sincronização ADN agora? (fila no portal)")) {
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      const r = await fetch(`${base}/sync`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({}),
      });
      if (r.status === 202) {
        setActionMsg("Pedido aceite. O job foi enfileirado.");
        await refresh();
        return;
      }
      if (r.status === 403) {
        setActionMsg("Apenas administradores da organização podem pedir sincronização ADN.");
        return;
      }
      if (r.status === 429) {
        const retry = r.headers.get("Retry-After");
        const j = (await r.json().catch(() => null)) as { message?: string } | null;
        const baseMsg =
          j?.message ?? "Serviço ocupado. Aguarde antes de voltar a pedir sincronização ADN.";
        setActionMsg(retry ? `${baseMsg} (tente novamente em ~${retry}s)` : baseMsg);
        return;
      }
      const j = (await r.json().catch(() => null)) as { message?: string } | null;
      setActionMsg(j?.message ?? "Não foi possível pedir a sincronização.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`adn-h2-${liveId}`}
      className="rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <h2 id={`adn-h2-${liveId}`} className="text-sm font-semibold">
        Sincronização ADN
      </h2>
      <p className="mt-2 text-xs text-black/55 dark:text-white/50">
        Estado da fila de sincronização com o ambiente nacional (NFS-e). Requer a funcionalidade
        activa na organização.
      </p>
      {access === "loading" ? (
        <p className="mt-3 text-xs text-black/50 dark:text-white/45">A carregar estado…</p>
      ) : null}
      {access === "feature_off" ? (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200" role="status">
          A sincronização ADN não está activa para esta organização (ou o recurso não está
          disponível). Contacte um administrador se precisar desta funcionalidade.
        </p>
      ) : null}
      {access === "forbidden" ? (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200" role="status">
          Não tem permissão para ver ou usar a sincronização ADN nesta empresa. Confirme a
          organização activa na sessão e o seu papel na empresa.
        </p>
      ) : null}
      {access === "error" ? (
        <p className="mt-3 text-xs text-red-800 dark:text-red-300" role="alert">
          Não foi possível carregar o estado ADN. Tente &quot;Actualizar&quot; ou volte mais tarde.
        </p>
      ) : null}
      {access === "active" ? (
        <>
          <div className="mt-3 text-sm text-black/75 dark:text-white/70" aria-live="polite">
            {lastJob ? (
              <p>
                Último job: <span className="font-mono text-xs">{lastJob.status}</span>
                {lastJob.createdAt ? (
                  <span className="ml-2 text-xs text-black/50 dark:text-white/45">
                    ({new Date(lastJob.createdAt).toLocaleString("pt-BR")})
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-xs text-black/55 dark:text-white/50">Ainda sem jobs ADN.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void requestSync()}
              className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-50"
            >
              Pedir sincronização ADN
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/15"
            >
              Actualizar
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy || access === "loading"}
            onClick={() => void refresh()}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/15 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
      )}
      {actionMsg ? (
        <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300" role="status">
          {actionMsg}
        </p>
      ) : null}
    </section>
  );
}

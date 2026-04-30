"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdnSyncLastJob, AdnSyncRecentJob } from "@/lib/adn-sync-client";
import { fetchAdnSyncStatus, postAdnSyncRequest } from "@/lib/adn-sync-client";
import { useUiToast } from "@/context/ui-toast";

export type AdnSyncPanelAccess = "loading" | "active" | "feature_off" | "forbidden" | "error";

/** Semântica de `actionMsg` para estilo e a11y (feedback QA: sucesso vs erro). */
export type AdnSyncActionTone = "none" | "success" | "error";

const CONFIRM_TEXT =
  "Pedir a busca de notas agora? O pedido entra na fila no portal com recolha incremental (notas novas desde o último checkpoint — mais rápido que varredura completa). O motor efectivo (ex. Playwright) é o definido no ambiente do worker.";

const ADN_ADAPTIVE_POLLING_ENABLED =
  typeof process.env.NEXT_PUBLIC_ADN_ADAPTIVE_POLLING_ENABLED === "string" &&
  (process.env.NEXT_PUBLIC_ADN_ADAPTIVE_POLLING_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_ADN_ADAPTIVE_POLLING_ENABLED === "true");

function isTerminalJobStatus(status: string): boolean {
  return status === "completed" || status === "partial" || status === "failed";
}

/** Intervalo de polling (ms) por estado do job; `null` = sem polling. MSYS-04 / NFR44. */
function pollIntervalMs(lastJob: AdnSyncLastJob | null, adaptive: boolean): number | null {
  if (!lastJob) {
    return null;
  }
  const s = lastJob.status;
  if (isTerminalJobStatus(s)) {
    return null;
  }
  if (!adaptive) {
    return s === "running" ? 8000 : null;
  }
  if (s === "queued") {
    return 5000;
  }
  if (s === "running") {
    return 8000;
  }
  return 6000;
}

export type UseAdnSyncForCompanyArgs = {
  /** `company.id` da API */
  companyId: string;
  /** `company.organizationId` da API (NFR29) */
  organizationId: string;
  /** Opcional: após sync aceite (202), revalidar readiness UIP (spec UX §9). */
  onSyncAccepted?: () => void;
};

export function useAdnSyncForCompany({ companyId, organizationId, onSyncAccepted }: UseAdnSyncForCompanyArgs) {
  const [access, setAccess] = useState<AdnSyncPanelAccess>("loading");
  const [lastJob, setLastJob] = useState<AdnSyncLastJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<AdnSyncRecentJob[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<AdnSyncActionTone>("none");
  const [busy, setBusy] = useState(false);
  const { showToast } = useUiToast();
  /** Evita toasts repetidos para o mesmo tipo de erro de limite (MSYS-04 AC5). */
  const lastRateToastRef = useRef<{ key: string; at: number } | null>(null);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!silent) {
        setAccess("loading");
        setActionMsg(null);
        setActionTone("none");
      }
      const result = await fetchAdnSyncStatus(organizationId, companyId);
      if (result.kind === "feature_off") {
        setAccess("feature_off");
        setLastJob(null);
        setRecentJobs([]);
        return;
      }
      if (result.kind === "forbidden") {
        setAccess("forbidden");
        setLastJob(null);
        setRecentJobs([]);
        return;
      }
      if (result.kind === "error") {
        if (!silent) {
          setAccess("error");
        }
        setLastJob(null);
        setRecentJobs([]);
        return;
      }
      setAccess("active");
      setLastJob(result.lastJob);
      setRecentJobs(result.recentJobs);
    },
    [companyId, organizationId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (access !== "active") {
      return;
    }
    const ms = pollIntervalMs(lastJob, ADN_ADAPTIVE_POLLING_ENABLED);
    if (ms == null) {
      return;
    }
    const id = window.setInterval(() => void refresh({ silent: true }), ms);
    return () => window.clearInterval(id);
  }, [access, lastJob, refresh]);

  const requestSync = useCallback(async () => {
    if (lastJob && !isTerminalJobStatus(lastJob.status)) {
      const msg =
        "Já existe um job ADN em execução para esta empresa. Aguarde a conclusão antes de pedir nova busca.";
      setActionTone("error");
      setActionMsg(msg);
      showToast({
        title: "Busca já em andamento",
        description: msg,
        tone: "error",
      });
      return;
    }
    if (!window.confirm(CONFIRM_TEXT)) {
      return;
    }
    setBusy(true);
    setActionMsg(null);
    setActionTone("none");
    try {
      const r = await postAdnSyncRequest(organizationId, companyId, crypto.randomUUID(), {
        fetchMode: "incremental",
      });
      if (r.kind === "accepted") {
        setActionTone("success");
        setActionMsg(
          "Pedido aceite: o job foi enfileirado no portal. Quando concluir, use «Ficheiros no portal» nesta ficha para o navegador descarregar (igual para coleta mensal). Espelho em disco no worker só com NFSE_LOCAL_MIRROR_ENABLED=1.",
        );
        showToast({
          title: "Pedido enfileirado",
          description: "A recolha começou no worker em segundo plano.",
          tone: "success",
        });
        await refresh();
        onSyncAccepted?.();
        return;
      }
      if (r.kind === "forbidden") {
        setActionTone("error");
        setActionMsg(r.message ?? "Não tem permissão para pedir sincronização ADN.");
        showToast({
          title: "Sem permissão",
          description: r.message ?? "Não tem permissão para pedir sincronização ADN.",
          tone: "error",
        });
        return;
      }
      if (r.kind === "rate_limited") {
        setActionTone("error");
        setActionMsg(r.message);
        const dedupeKey = `429:${organizationId}:${companyId}:${r.retryAfter ?? ""}`;
        const now = Date.now();
        const prev = lastRateToastRef.current;
        if (!prev || prev.key !== dedupeKey || now - prev.at > 10_000) {
          lastRateToastRef.current = { key: dedupeKey, at: now };
          showToast({
            title: "Muitos pedidos",
            description: r.message,
            tone: "error",
          });
        }
        return;
      }
      setActionTone("error");
      setActionMsg(r.message);
      showToast({
        title: "Falha ao enfileirar",
        description: r.message,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [companyId, lastJob, organizationId, onSyncAccepted, refresh, showToast]);

  const requestRemirror = useCallback(
    async (sourceJobId: string) => {
      setBusy(true);
      setActionMsg(null);
      setActionTone("none");
      try {
        const r = await postAdnSyncRequest(organizationId, companyId, crypto.randomUUID(), {
          remirrorFromJobId: sourceJobId,
        });
        if (r.kind === "accepted") {
          setActionTone("success");
          setActionMsg(
            "Pedido aceite: o worker vai regravar na pasta raiz os XML/PDF já guardados no portal para esse job (quando o disco e o serviço de recolha estiverem configurados).",
          );
          showToast({
            title: "Espelho na fila",
            description: "O job de regravação foi enfileirado.",
            tone: "success",
          });
          await refresh({ silent: true });
          onSyncAccepted?.();
          return;
        }
        if (r.kind === "forbidden") {
          setActionTone("error");
          setActionMsg(r.message ?? "Sem permissão.");
          showToast({
            title: "Sem permissão",
            description: r.message ?? "Sem permissão.",
            tone: "error",
          });
          return;
        }
        if (r.kind === "rate_limited") {
          setActionTone("error");
          setActionMsg(r.message);
          showToast({ title: "Muitos pedidos", description: r.message, tone: "error" });
          return;
        }
        setActionTone("error");
        setActionMsg(r.message);
        showToast({ title: "Não foi possível enfileirar", description: r.message, tone: "error" });
      } finally {
        setBusy(false);
      }
    },
    [companyId, organizationId, onSyncAccepted, refresh, showToast],
  );

  return {
    access,
    lastJob,
    recentJobs,
    busy,
    actionMsg,
    actionTone,
    refresh,
    requestSync,
    requestRemirror,
  };
}

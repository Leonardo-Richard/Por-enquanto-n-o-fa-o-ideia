"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdnSyncLastJob } from "@/lib/adn-sync-client";
import { fetchAdnSyncStatus, postAdnSyncRequest } from "@/lib/adn-sync-client";
import { useUiToast } from "@/context/ui-toast";

export type AdnSyncPanelAccess = "loading" | "active" | "feature_off" | "forbidden" | "error";

/** Semântica de `actionMsg` para estilo e a11y (feedback QA: sucesso vs erro). */
export type AdnSyncActionTone = "none" | "success" | "error";

const CONFIRM_TEXT =
  "Pedir a busca de notas agora? O pedido entra na fila no portal e tentará recolha completa (todas as notas disponíveis no ADN para a empresa).";

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
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<AdnSyncActionTone>("none");
  const [busy, setBusy] = useState(false);
  const { showToast } = useUiToast();

  const refresh = useCallback(async () => {
    setAccess("loading");
    setActionMsg(null);
    setActionTone("none");
    const result = await fetchAdnSyncStatus(organizationId, companyId);
    if (result.kind === "feature_off") {
      setAccess("feature_off");
      setLastJob(null);
      return;
    }
    if (result.kind === "forbidden") {
      setAccess("forbidden");
      setLastJob(null);
      return;
    }
    if (result.kind === "error") {
      setAccess("error");
      setLastJob(null);
      return;
    }
    setAccess("active");
    setLastJob(result.lastJob);
  }, [companyId, organizationId]);

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

  const requestSync = useCallback(async () => {
    if (!window.confirm(CONFIRM_TEXT)) {
      return;
    }
    setBusy(true);
    setActionMsg(null);
    setActionTone("none");
    try {
      const r = await postAdnSyncRequest(organizationId, companyId, crypto.randomUUID(), {
        fetchMode: "all",
      });
      if (r.kind === "accepted") {
        setActionTone("success");
        setActionMsg(
          "Pedido aceite: o job foi enfileirado no portal. Quando o job concluir, os XML/PDF podem ser espelhados na pasta raiz configurada (se aplicável ao seu ambiente).",
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
        setActionMsg(
          r.message ?? "Apenas administradores da organização podem pedir sincronização ADN.",
        );
        showToast({
          title: "Sem permissão",
          description: r.message ?? "Apenas administradores da organização podem pedir sincronização ADN.",
          tone: "error",
        });
        return;
      }
      if (r.kind === "rate_limited") {
        setActionTone("error");
        setActionMsg(r.message);
        showToast({
          title: "Muitos pedidos",
          description: r.message,
          tone: "error",
        });
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
  }, [companyId, organizationId, onSyncAccepted, refresh, showToast]);

  return {
    access,
    lastJob,
    busy,
    actionMsg,
    actionTone,
    refresh,
    requestSync,
  };
}

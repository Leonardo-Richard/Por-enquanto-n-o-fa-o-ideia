"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Company } from "@repo/shared";
import { AdnCertificateReadinessCard } from "@/app/(dashboard)/empresas/[id]/adn-certificate-readiness-card";
import { LocalDownloadRootCallout } from "@/app/(dashboard)/empresas/[id]/local-download-root-callout";
import { getAdnCertRunbookUrl } from "@/lib/adn-cert-runbook-url";
import { runbookAnchorProps } from "@/lib/adn-runbook-anchor";
import { useAdnSyncForCompany } from "@/hooks/use-adn-sync-for-company";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { useOrganizationAdnSyncSettings } from "@/hooks/use-organization-adn-sync-settings";
import { isCertUploadUiEnabled } from "@/lib/cert-upload-ui-enabled";

function isLocalDownloadRootConfigured(root: string | null | undefined): boolean {
  return typeof root === "string" && root.trim().length > 0;
}

export function AdnSyncPanel({ company }: { company: Company }) {
  const liveId = useId();
  const helpDialogId = `${liveId}-adn-help`;
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [readinessKick, setReadinessKick] = useState(0);

  const bumpReadiness = useCallback(() => {
    setReadinessKick((k) => k + 1);
  }, []);

  const { effectiveOrganizationId, loading: meOrgLoading } = useMeSummary();

  const { access, lastJob, busy, actionMsg, actionTone, refresh, requestSync } = useAdnSyncForCompany({
      companyId: company.id,
      organizationId: company.organizationId,
      onSyncAccepted: bumpReadiness,
    });

  const orgAligned =
    Boolean(company.organizationId) &&
    Boolean(effectiveOrganizationId) &&
    company.organizationId === effectiveOrganizationId;

  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      !meOrgLoading &&
      effectiveOrganizationId &&
      company.organizationId !== effectiveOrganizationId
    ) {
      // Estratégia AC11: não GET settings nem callout com valores; apenas diagnóstico local.
      console.warn(
        "[AdnSyncPanel] company.organizationId difere da organização activa; bloco de pasta raiz omitido.",
      );
    }
  }, [meOrgLoading, effectiveOrganizationId, company.organizationId]);

  const settingsFetchEnabled =
    orgAligned && !meOrgLoading && (access === "active" || access === "forbidden");

  const {
    loading: settingsLoading,
    data: settingsData,
    error: settingsError,
  } = useOrganizationAdnSyncSettings({
    organizationId: company.organizationId,
    fetchEnabled: settingsFetchEnabled,
  });

  /** Certificado + readiness: sempre que não for explícito «sem permissão» (inclui org sem fila ADN e o carregamento inicial). */
  const showCertificateSection =
    access === "loading" ||
    access === "active" ||
    access === "feature_off" ||
    access === "error";

  const runbookUrl = getAdnCertRunbookUrl();
  const runbookAnchor = runbookUrl ? runbookAnchorProps(runbookUrl) : {};

  const closeHelp = useCallback(() => {
    dialogRef.current?.close();
    setHelpOpen(false);
    helpTriggerRef.current?.focus();
  }, []);

  const openHelp = useCallback(() => {
    setHelpOpen(true);
    queueMicrotask(() => {
      dialogRef.current?.showModal();
    });
  }, []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) {
      return;
    }
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeHelp();
    };
    dlg.addEventListener("cancel", onCancel);
    return () => dlg.removeEventListener("cancel", onCancel);
  }, [closeHelp]);

  useEffect(() => {
    if (!helpOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, closeHelp]);

  const showAdnRootContext = settingsFetchEnabled;
  /** Spec UX §5.1: último job e acções imediatamente após FR67/callout; certificado/readiness depois no ramo `active`. */
  const showCertificateAfterAdnActions = access === "active";

  return (
    <section
      aria-labelledby={`adn-h2-${liveId}`}
      className="rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <h2 id={`adn-h2-${liveId}`} className="text-sm font-semibold">
        Sincronização ADN
      </h2>
      <p className="mt-1 text-xs font-medium text-black/50 dark:text-white/45">
        Buscar notas no Ambiente Nacional
      </p>
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
          {isCertUploadUiEnabled() ? (
            <>
              {" "}
              Se a API de registo de certificado estiver activa no servidor, pode enviar o ficheiro
              abaixo mesmo antes de activar a fila ADN para a organização.
            </>
          ) : null}
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

      {showAdnRootContext ? (
        settingsLoading ? (
          <p className="mt-3 text-xs text-black/50 dark:text-white/45">A carregar definições…</p>
        ) : settingsData && !settingsError ? (
          <>
            <p className="mt-3 text-xs text-black/55 dark:text-white/50" role="status">
              O pedido no portal enfileira um job de recolha no Ambiente Nacional; não transfere
              ficheiros directamente pelo browser. Os XML e PDF no disco do servidor de recolha
              dependem da pasta raiz configurada para a organização e do worker.
            </p>
            <div className="mt-2">
              {isLocalDownloadRootConfigured(settingsData.localDownloadRoot) ? (
                <LocalDownloadRootCallout variant="configured" />
              ) : (
                <LocalDownloadRootCallout variant="missing" />
              )}
            </div>
          </>
        ) : settingsError ? (
          <p className="mt-3 text-xs text-black/55 dark:text-white/50" role="status">
            Não foi possível carregar a pasta raiz da organização. Pode continuar a usar a fila ADN;
            tente &quot;Actualizar&quot; ou abra{" "}
            <Link
              href="/configuracoes"
              className="font-medium text-emerald-800 underline decoration-emerald-800/40 underline-offset-2 dark:text-emerald-300 dark:decoration-emerald-300/40"
            >
              Configurações
            </Link>{" "}
            para confirmar o caminho local.
          </p>
        ) : null
      ) : null}

      {!showCertificateAfterAdnActions && showCertificateSection ? (
        <AdnCertificateReadinessCard
          organizationId={company.organizationId}
          companyId={company.id}
          cnpjDigits={company.cnpjDigits}
          onCertificateRegistered={bumpReadiness}
          refreshSignal={readinessKick}
        />
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
              aria-busy={busy}
              aria-label="Buscar notas agora no Ambiente Nacional"
              onClick={() => void requestSync()}
              className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-50"
            >
              Buscar notas agora
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label="Actualizar estado da fila ADN"
              onClick={() => void refresh()}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/15"
            >
              Actualizar
            </button>
          </div>
          <div className="mt-3">
            <button
              ref={helpTriggerRef}
              type="button"
              className="text-xs font-medium text-emerald-800 underline decoration-emerald-800/40 underline-offset-2 hover:decoration-emerald-800 dark:text-emerald-300 dark:decoration-emerald-300/40"
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              aria-controls={helpDialogId}
              onClick={() => openHelp()}
            >
              Como funciona?
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy || access === "loading"}
            aria-label="Actualizar estado da fila ADN"
            onClick={() => void refresh()}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/15 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
      )}
      {showCertificateAfterAdnActions && showCertificateSection ? (
        <AdnCertificateReadinessCard
          organizationId={company.organizationId}
          companyId={company.id}
          cnpjDigits={company.cnpjDigits}
          onCertificateRegistered={bumpReadiness}
          refreshSignal={readinessKick}
        />
      ) : null}
      {actionMsg ? (
        <p
          className={
            actionTone === "success"
              ? "mt-3 text-xs text-emerald-800 dark:text-emerald-300"
              : "mt-3 text-xs text-amber-900 dark:text-amber-200"
          }
          role={actionTone === "success" ? "status" : "alert"}
        >
          {actionMsg}
        </p>
      ) : null}

      <dialog
        id={helpDialogId}
        ref={dialogRef}
        className="max-w-md rounded-xl border border-black/10 bg-[var(--background)] p-6 text-sm shadow-xl backdrop:bg-black/40 dark:border-white/15"
        aria-labelledby={`${helpDialogId}-title`}
        onClose={() => setHelpOpen(false)}
      >
        <h3 id={`${helpDialogId}-title`} className="font-semibold text-black/90 dark:text-white/90">
          Como funciona a sincronização ADN?
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-black/80 dark:text-white/75">
          <li>
            O estado &quot;Pronto para o ADN&quot; resulta de uma verificação automática no servidor de recolha —
            não significa que existam notas novas.
          </li>
          <li>
            O certificado de cliente para o ADN permanece na infraestrutura de recolha da
            organização, não no browser.
          </li>
          <li>
            O portal apenas enfileira pedidos; a ligação ao Ambiente Nacional corre no worker. Em
            períodos de pico, a conclusão pode demorar.
          </li>
          <li>
            Com pasta raiz configurada em Configurações, o worker pode espelhar XML/PDF no disco
            do servidor de recolha após o job concluir — fluxo assíncrono, independente do browser.
          </li>
          <li>
            O certificado digital da empresa é tratado pela infraestrutura de recolha. Saiba mais
            no{" "}
            {runbookUrl ? (
              <a
                href={runbookUrl}
                {...runbookAnchor}
                className="font-medium text-emerald-800 underline decoration-emerald-800/40 underline-offset-2 dark:text-emerald-300"
              >
                guia
              </a>
            ) : (
              <span className="text-black/55 dark:text-white/50">guia (ainda não configurado)</span>
            )}{" "}
            para equipas técnicas.
          </li>
        </ul>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
            onClick={() => closeHelp()}
          >
            Fechar
          </button>
        </div>
      </dialog>
    </section>
  );
}

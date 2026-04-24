"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Company } from "@repo/shared";
import { AdnCertificateReadinessCard } from "@/app/(dashboard)/empresas/[id]/adn-certificate-readiness-card";
import { getAdnCertRunbookUrl } from "@/lib/adn-cert-runbook-url";
import { runbookAnchorProps } from "@/lib/adn-runbook-anchor";
import { useAdnSyncForCompany } from "@/hooks/use-adn-sync-for-company";

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

  const { access, lastJob, busy, actionMsg, actionTone, refresh, requestSync } = useAdnSyncForCompany({
    companyId: company.id,
    organizationId: company.organizationId,
    onSyncAccepted: bumpReadiness,
  });

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
          <AdnCertificateReadinessCard
            organizationId={company.organizationId}
            companyId={company.id}
            refreshSignal={readinessKick}
          />
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
            onClick={() => void refresh()}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/15 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
      )}
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

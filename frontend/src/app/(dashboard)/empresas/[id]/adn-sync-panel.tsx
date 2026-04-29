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
import { mirrorSummaryFromJobSummary } from "@/lib/adn-job-mirror-summary";
import { mirrorDestinationPathPreview } from "@/lib/mirror-destination-preview";

function isLocalDownloadRootConfigured(root: string | null | undefined): boolean {
  return typeof root === "string" && root.trim().length > 0;
}

function isAdnJobInProgress(status: string | null | undefined): boolean {
  return status === "queued" || status === "running";
}

function isTerminalAdnJobStatus(status: string | null | undefined): boolean {
  return status === "completed" || status === "partial" || status === "failed";
}

function JobMirrorLine({ summary }: { summary: Record<string, unknown> | null }) {
  const ms = mirrorSummaryFromJobSummary(summary);
  if (!ms?.hasMirrorMetrics) {
    return null;
  }
  return (
    <span className="mt-1 block text-black/45 dark:text-white/42">
      Espelho neste job: {ms.written} cópia(s)
      {ms.failed > 0 ? ` · ${ms.failed} falha(s)` : ""}
    </span>
  );
}

/** Jobs terminados com pelo menos um artefacto no portal — elegíveis para regravar na pasta raiz. */
function canRemirrorFromJobRow(j: { status: string; artifactCount: number }): boolean {
  if (j.artifactCount <= 0) {
    return false;
  }
  return j.status === "completed" || j.status === "partial" || j.status === "failed";
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

  const {
    access,
    lastJob,
    recentJobs,
    busy,
    actionMsg,
    actionTone,
    refresh,
    requestSync,
    requestRemirror,
  } = useAdnSyncForCompany({
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
  const hasJobInProgress = isAdnJobInProgress(lastJob?.status);
  const remirrorCandidates = recentJobs.filter(canRemirrorFromJobRow);
  const remirrorRootReady =
    !settingsLoading &&
    Boolean(
      settingsData &&
        !settingsError &&
        isLocalDownloadRootConfigured(settingsData.localDownloadRoot),
    );

  const lastJobMirrorSummary =
    lastJob && isTerminalAdnJobStatus(lastJob.status)
      ? mirrorSummaryFromJobSummary(lastJob.summary)
      : null;
  const rootConfiguredForHints =
    Boolean(settingsData && !settingsError && isLocalDownloadRootConfigured(settingsData?.localDownloadRoot));

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
              dependem da pasta raiz configurada para a organização e do worker. O worker grava
              dentro de uma <strong className="font-medium">subpasta</strong> com o nome{" "}
              <span className="font-mono text-[11px]">«Código-Apelido»</span> (como na Domínio Web: código
              e nome fantasia da empresa neste portal, sem espaços em volta do hífen), não na raiz
              directamente.
            </p>
            <div className="mt-2">
              {isLocalDownloadRootConfigured(settingsData.localDownloadRoot) ? (
                <LocalDownloadRootCallout
                  variant="configured"
                  pathPreview={mirrorDestinationPathPreview(
                    String(settingsData.localDownloadRoot).trim(),
                    company.systemCode,
                    company.tradeName,
                    company.cnpjDigits,
                  )}
                />
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
            {lastJobMirrorSummary ? (
              <div
                className="mt-3 rounded-lg border border-black/8 bg-black/[0.03] p-3 text-xs leading-relaxed dark:border-white/10 dark:bg-white/[0.04]"
                role="status"
              >
                <p className="font-medium text-black/80 dark:text-white/75">Gravação no disco (worker)</p>
                {lastJobMirrorSummary.hasMirrorMetrics ? (
                  <p className="mt-1 text-black/65 dark:text-white/60">
                    {lastJobMirrorSummary.written} ficheiro(s) copiado(s) neste job
                    {lastJobMirrorSummary.failed > 0
                      ? ` · ${lastJobMirrorSummary.failed} falha(s)`
                      : ""}
                    .
                    {lastJobMirrorSummary.sourceXmlCount !== null &&
                    lastJobMirrorSummary.engine === "NFSE_dist" ? (
                      <span className="ml-1">
                        {" "}
                        XML encontrados na origem NFSE_dist:{" "}
                        <span className="font-mono tabular-nums">{lastJobMirrorSummary.sourceXmlCount}</span>.
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-1 text-amber-900/90 dark:text-amber-100/85">
                    O resumo deste job não inclui contadores de espelho (worker desactualizado ou resumo
                    incompleto). Actualize o <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10">nfse-portal-bridge</code>.
                  </p>
                )}
                {lastJobMirrorSummary.destinationPath ? (
                  <p className="mt-2 break-all font-mono text-[11px] text-black/70 dark:text-white/65">
                    Caminho usado pelo worker: {lastJobMirrorSummary.destinationPath}
                  </p>
                ) : null}
                {lastJobMirrorSummary.operationalHint ? (
                  <p className="mt-2 text-sm leading-relaxed text-amber-950/95 dark:text-amber-50/90">
                    {lastJobMirrorSummary.operationalHint}
                  </p>
                ) : null}
                {lastJobMirrorSummary.hasMirrorMetrics &&
                lastJobMirrorSummary.written === 0 &&
                lastJobMirrorSummary.failed === 0 &&
                rootConfiguredForHints &&
                !lastJobMirrorSummary.operationalHint ? (
                  <p className="mt-2 text-amber-900/90 dark:text-amber-100/85">
                    Com pasta raiz definida, 0 cópias costuma indicar que o processo{" "}
                    <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10">poll_jobs.py</code>{" "}
                    não corre na máquina onde esse caminho existe, ou{" "}
                    <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10">NFSE_LOCAL_MIRROR_DISABLED=1</code>
                    , ou não houve XML/PDF em{" "}
                    <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10">NFSE_dist/data/&lt;CNPJ&gt;/</code>{" "}
                    após a recolha.
                  </p>
                ) : null}
                {lastJobMirrorSummary.hadFailures && lastJobMirrorSummary.errorsSample.length > 0 ? (
                  <ul className="mt-2 list-disc pl-4 text-black/55 dark:text-white/50">
                    {lastJobMirrorSummary.errorsSample.map((err) => (
                      <li key={err} className="break-all font-mono text-[11px]">
                        {err}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {lastJob?.status === "queued" ? (
              <div
                className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/40 dark:text-amber-50/95"
                role="status"
              >
                <p className="font-semibold">Porque o job fica em «queued»?</p>
                <p className="mt-1.5">
                  Este estado significa que o pedido está na base de dados à espera do{" "}
                  <strong className="font-medium">worker de recolha</strong> (
                  <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">
                    workers/nfse-portal-bridge/poll_jobs.py
                  </code>
                  ). Enquanto o processo <strong className="font-medium">não estiver a correr</strong> na
                  mesma instância de Postgres que o portal, o job <strong className="font-medium">não avança</strong>{" "}
                  para «running» nem para «completed». Em desenvolvimento, na raiz do repositório pode usar{" "}
                  <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">
                    npm run dev:with-adn-bridge
                  </code>{" "}
                  (Next + worker em paralelo), ou só{" "}
                  <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">
                    npm run worker:adn-bridge
                  </code>{" "}
                  com o portal já a correr.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>
                    <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">DATABASE_URL</code>{" "}
                    do worker = do portal (mesmo Postgres).
                  </li>
                  <li>
                    <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">PORTAL_INTERNAL_URL</code>{" "}
                    ou <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">API_INTERNAL_URL</code>{" "}
                    aponta para o mesmo Next que serve{" "}
                    <code className="font-mono text-[11px]">/api/internal/v1/adn/</code> (frontend em{" "}
                    <code className="font-mono text-[11px]">:3000</code> ou backend em{" "}
                    <code className="font-mono text-[11px]">:3001</code>). O script{" "}
                    <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">npm run worker:adn-bridge</code>{" "}
                    tenta detectar a porta automaticamente se não definir estas variáveis.
                  </li>
                  <li>
                    <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">ADN_WORKER_HMAC_SECRET</code>{" "}
                    igual ao definido no servidor do portal.
                  </li>
                  <li>
                    Em <strong className="font-medium">Configurações</strong>, a sincronização ADN da organização
                    tem de estar <strong className="font-medium">activa</strong> (o worker ignora filas de orgs com ADN
                    desligado).
                  </li>
                </ul>
              </div>
            ) : null}
            {lastJob?.status === "running" ? (
              <div
                className="mt-3 rounded-lg border border-sky-200/80 bg-sky-50/90 p-3 text-xs leading-relaxed text-sky-950 dark:border-sky-400/30 dark:bg-sky-950/35 dark:text-sky-50/95"
                role="status"
              >
                <p className="font-semibold">Job em «running»</p>
                <p className="mt-1.5">
                  O worker já reservou o job. A recolha no Ambiente Nacional pode demorar bastante. Se o estado
                  não mudar durante muito tempo, abra a consola onde corre{" "}
                  <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/15">poll_jobs.py</code>{" "}
                  para ver erros (certificado, rede, NFSE_dist, etc.).
                </p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || hasJobInProgress}
              aria-busy={busy || hasJobInProgress}
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
          {remirrorCandidates.length > 0 ? (
            <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/15">
              <h3 className="text-xs font-semibold text-black/90 dark:text-white/90">
                Gravar na pasta raiz (jobs já executados)
              </h3>
              <p className="mt-1 text-xs text-black/55 dark:text-white/50">
                Volta a copiar para a pasta configurada em Configurações os XML/PDF já guardados no portal
                nesses jobs. O serviço de recolha (worker) tem de estar a correr no PC onde essa pasta existe.
              </p>
              {!remirrorRootReady ? (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200" role="status">
                  Defina e guarde a pasta raiz da organização em Configurações para activar estes botões.
                </p>
              ) : null}
              <ul className="mt-3 space-y-2" aria-label="Jobs com artefactos para regravar">
                {remirrorCandidates.map((j) => (
                  <li
                    key={j.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/5 bg-black/[0.02] px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]"
                  >
                    <div className="min-w-0 text-xs">
                      <span className="font-mono text-[11px] text-black/70 dark:text-white/65">
                        {j.id.slice(0, 8)}…
                      </span>
                      <span className="ml-2 text-black/55 dark:text-white/50">{j.status}</span>
                      <span className="ml-2 text-black/45 dark:text-white/45">
                        · {j.artifactCount} ficheiro(s)
                      </span>
                      {j.createdAt ? (
                        <span className="ml-2 text-black/40 dark:text-white/40">
                          {new Date(j.createdAt).toLocaleString("pt-BR")}
                        </span>
                      ) : null}
                      <JobMirrorLine summary={j.summary ?? null} />
                    </div>
                    <button
                      type="button"
                      disabled={busy || !remirrorRootReady}
                      className="shrink-0 rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium dark:border-white/20 disabled:opacity-50"
                      onClick={() => void requestRemirror(j.id)}
                    >
                      Gravar na pasta raiz
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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

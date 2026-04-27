"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdnCertificateRegistrationForm } from "@/app/(dashboard)/empresas/[id]/adn-certificate-registration-form";
import { useAdnCertificateReadiness } from "@/hooks/use-adn-certificate-readiness";
import { getAdnCertRunbookUrl } from "@/lib/adn-cert-runbook-url";
import { runbookAnchorProps } from "@/lib/adn-runbook-anchor";
import { isCertUploadUiEnabled } from "@/lib/cert-upload-ui-enabled";

const COPY_PENDENTE =
  "Ainda não confirmámos se o servidor de recolha está preparado para o certificado desta empresa. Peça à equipa técnica que siga o guia ou clique em Verificar após a configuração.";

const COPY_PRONTO =
  "O servidor de recolha parece preparado para autenticar pedidos ao Ambiente Nacional para este CNPJ.";

const SECURITY_NOTE =
  "O certificado não é instalado nesta página — apenas no servidor de recolha da organização.";

function badgeLabel(state: string): string {
  if (state === "pronto") {
    return "Pronto para o ADN";
  }
  if (state === "erro") {
    return "Problema na configuração";
  }
  return "A verificar";
}

function stateDescription(
  readiness: "pendente_verificacao" | "pronto" | "erro",
  userMessage: string | null,
): string {
  if (readiness === "pronto") {
    return COPY_PRONTO;
  }
  if (readiness === "erro") {
    return userMessage?.trim() || COPY_PENDENTE;
  }
  return COPY_PENDENTE;
}

function liveAnnounceLabel(readiness: "pendente_verificacao" | "pronto" | "erro"): string {
  if (readiness === "pronto") {
    return "Estado do certificado actualizado: pronto para o ADN.";
  }
  if (readiness === "erro") {
    return "Estado do certificado actualizado: problema na configuração.";
  }
  return "Estado do certificado actualizado: a verificar.";
}

export function AdnCertificateReadinessCard({
  organizationId,
  companyId,
  cnpjDigits,
  onCertificateRegistered,
  /** Incrementa após sync ADN aceite para revalidar GET readiness (spec UX §9). */
  refreshSignal = 0,
}: {
  organizationId: string;
  companyId: string;
  cnpjDigits: string;
  onCertificateRegistered?: () => void;
  refreshSignal?: number;
}) {
  const baseId = useId();
  const titleId = `${baseId}-cert-title`;
  const { access, data, busy, verifyError, refresh, verify } = useAdnCertificateReadiness({
    organizationId,
    companyId,
  });
  const [liveMsg, setLiveMsg] = useState<string | null>(null);
  const prevKickRef = useRef(0);

  const runbookUrl = getAdnCertRunbookUrl();
  const runbookAnchor = runbookUrl ? runbookAnchorProps(runbookUrl) : {};

  useEffect(() => {
    if (refreshSignal > prevKickRef.current) {
      prevKickRef.current = refreshSignal;
      void refresh();
    }
  }, [refreshSignal, refresh]);

  useEffect(() => {
    if (!liveMsg) {
      return;
    }
    const t = window.setTimeout(() => setLiveMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [liveMsg]);

  const onVerifyClick = useCallback(async () => {
    const r = await verify();
    if (r?.kind === "ok" && r.data) {
      setLiveMsg(liveAnnounceLabel(r.data.certificateReadiness));
    }
  }, [verify]);

  if (access === "loading") {
    return (
      <div
        className="mb-4 rounded-xl border border-black/8 bg-white/60 p-4 dark:border-white/12 dark:bg-white/[0.04]"
        aria-busy="true"
      >
        <h3 className="text-sm font-semibold text-black/90 dark:text-white/90">Certificado para o ADN</h3>
        <p className="mt-2 text-xs text-black/55 dark:text-white/50" role="status">
          A carregar estado do certificado…
        </p>
      </div>
    );
  }

  if (access === "forbidden") {
    return null;
  }

  if (access === "feature_off") {
    return (
      <div
        role="region"
        aria-labelledby={`${baseId}-cert-off-title`}
        className="mb-4 rounded-xl border border-black/8 bg-white/60 p-4 dark:border-white/12 dark:bg-white/[0.04]"
      >
        <h3
          id={`${baseId}-cert-off-title`}
          className="text-sm font-semibold text-black/90 dark:text-white/90"
        >
          Certificado para o ADN
        </h3>
        <p className="mt-2 text-sm text-black/75 dark:text-white/70">
          O portal não encontrou o endpoint de verificação de certificado neste ambiente (por exemplo, a API de
          registo ainda desactivada no processo Node). Defina{" "}
          <span className="font-mono text-[11px] sm:text-xs">CERT_UPLOAD_API_ENABLED=true</span> no ficheiro{" "}
          <span className="font-mono text-[11px] sm:text-xs">.env</span> na raiz do repositório ou em{" "}
          <span className="font-mono text-[11px] sm:text-xs">apps/web/.env.local</span>, guarde e reinicie o{" "}
          <span className="font-mono text-[11px] sm:text-xs">npm run dev</span>.
        </p>
        {runbookUrl ? (
          <p className="mt-2 text-sm">
            <a
              href={runbookUrl}
              {...runbookAnchor}
              className="font-medium text-sky-900 underline decoration-sky-900/35 underline-offset-2 dark:text-sky-200 dark:decoration-sky-200/40"
            >
              Como configurar o certificado no servidor de recolha
            </a>
          </p>
        ) : null}
        {isCertUploadUiEnabled() ? (
          <AdnCertificateRegistrationForm
            organizationId={organizationId}
            companyId={companyId}
            cnpjDigits={cnpjDigits}
            onRegistered={() => {
              onCertificateRegistered?.();
              void refresh();
            }}
          />
        ) : (
          <p className="mt-3 text-xs text-black/55 dark:text-white/50">
            Para mostrar o envio de ficheiro (.pfx / .p12) aqui, active também{" "}
            <span className="font-mono text-[11px]">NEXT_PUBLIC_CERT_UPLOAD_UI_ENABLED=true</span> e reinicie o
            servidor de desenvolvimento.
          </p>
        )}
        <p className="mt-3 text-xs text-black/55 dark:text-white/50">{SECURITY_NOTE}</p>
      </div>
    );
  }

  if (access === "error") {
    return (
      <div className="mb-4 rounded-lg border border-amber-900/20 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 dark:border-amber-200/25 dark:bg-amber-950/30 dark:text-amber-50">
        <p role="status">Não foi possível obter o estado do certificado.</p>
        <button
          type="button"
          className="mt-2 font-medium text-emerald-900 underline decoration-emerald-900/40 dark:text-emerald-200"
          onClick={() => void refresh()}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const readiness = data.certificateReadiness;
  const ariaLive = liveMsg ? "polite" : "off";

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="mb-4 rounded-xl border border-black/8 bg-white/60 p-4 dark:border-white/12 dark:bg-white/[0.04]"
    >
      <h3 id={titleId} className="text-sm font-semibold text-black/90 dark:text-white/90">
        Certificado para o ADN
      </h3>

      <div aria-live={ariaLive} aria-atomic="true" className="sr-only">
        {liveMsg}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-0.5 text-xs font-medium text-black/85 dark:border-white/15 dark:bg-white/10 dark:text-white/90"
          data-state={readiness}
          aria-label={`Estado do certificado: ${badgeLabel(readiness)}.`}
        >
          {badgeLabel(readiness)}
        </span>
        {data.probeAvailable === false ? (
          <span className="text-xs text-black/50 dark:text-white/45">
            Verificação automática no worker ainda não está activa neste ambiente.
          </span>
        ) : null}
      </div>

      {readiness !== "erro" ? (
        <p className="mt-2 text-sm text-black/75 dark:text-white/70">
          {stateDescription(readiness, data.userMessage)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-black/75 dark:text-white/70">
          Não foi possível confirmar a preparação do certificado no servidor de recolha.
        </p>
      )}

      {readiness === "erro" ? (
        <Alert variant="destructive" className="mt-3 px-3 py-2">
          <span
            className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-red-900/15 text-[10px] font-bold text-red-900 dark:bg-red-200/15 dark:text-red-100"
            aria-hidden="true"
          >
            !
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <AlertTitle className="text-red-950 dark:text-red-50">Configuração do certificado</AlertTitle>
            <AlertDescription className="text-red-950/90 dark:text-red-50/95">
              <p>
                {data.userMessage?.trim() ||
                  "Não foi possível validar a configuração do certificado. Consulte o guia técnico ou o suporte."}
              </p>
              {runbookUrl ? (
                <p className="mt-2">
                  <a
                    href={runbookUrl}
                    {...runbookAnchor}
                    className="font-medium text-red-900 underline decoration-red-900/40 underline-offset-2 dark:text-red-200 dark:decoration-red-200/40"
                  >
                    Ver guia técnico
                  </a>
                </p>
              ) : null}
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {data.canVerify ? (
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void onVerifyClick()}
            className="rounded-lg border border-black/12 bg-black/[0.03] px-4 py-2 text-sm font-medium text-black/90 min-h-[44px] min-w-[44px] dark:border-white/18 dark:bg-white/[0.06] dark:text-white/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:focus-visible:outline-emerald-300"
          >
            {busy ? "A verificar…" : "Verificar de novo"}
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Apenas administradores da organização podem verificar."
            className="rounded-lg border border-black/10 px-4 py-2 text-sm text-black/45 dark:border-white/15 dark:text-white/40"
          >
            Verificar de novo (apenas admin)
          </button>
        )}
        {runbookUrl ? (
          <a
            href={runbookUrl}
            {...runbookAnchor}
            className="text-sm font-medium text-sky-900 underline decoration-sky-900/35 underline-offset-2 min-h-[44px] inline-flex items-center dark:text-sky-200 dark:decoration-sky-200/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:focus-visible:outline-emerald-300"
            title="Abrir guia técnico de certificado e recolha ADN"
          >
            Como configurar o certificado no servidor de recolha
          </a>
        ) : (
          <span className="text-xs text-black/50 dark:text-white/45">Guia técnico ainda não configurado.</span>
        )}
      </div>

      {isCertUploadUiEnabled() && data.canVerify ? (
        <AdnCertificateRegistrationForm
          organizationId={organizationId}
          companyId={companyId}
          cnpjDigits={cnpjDigits}
          onRegistered={() => {
            onCertificateRegistered?.();
            void refresh();
          }}
        />
      ) : null}

      <p className="mt-3 text-xs text-black/55 dark:text-white/50">{SECURITY_NOTE}</p>

      <p className="mt-2 text-xs text-black/55 dark:text-white/45">
        A ligação ao Ambiente Nacional usa o certificado da empresa instalado no servidor de recolha — não nesta
        página.
      </p>
      <p className="mt-1 text-xs text-black/55 dark:text-white/45">
        A sua equipa técnica pode seguir o guia oficial para instalar ou renovar o certificado.
      </p>

      {verifyError ? (
        <p className="mt-2 text-xs text-amber-900 dark:text-amber-200" role="alert">
          {verifyError}
        </p>
      ) : null}
    </div>
  );
}

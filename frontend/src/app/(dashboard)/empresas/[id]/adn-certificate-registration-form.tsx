"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUiToast } from "@/context/ui-toast";
import type { CompanyCertificateGetResponse } from "@repo/shared";
import { certUploadMessageForCode, formatCnpj, type CertUploadErrorCode } from "@repo/shared";

function clientCertUploadMaxMbHint(): number {
  const raw = process.env.NEXT_PUBLIC_CERT_UPLOAD_MAX_MB?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 5;
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function buildCertificateApiUrl(organizationId: string, companyId: string): string {
  return `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/certificate`;
}

export function AdnCertificateRegistrationForm({
  organizationId,
  companyId,
  cnpjDigits,
  onRegistered,
}: {
  organizationId: string;
  companyId: string;
  cnpjDigits: string;
  onRegistered: () => void;
}) {
  const baseId = useId();
  const legendId = `${baseId}-cert-reg-legend`;
  const errId = `${baseId}-cert-reg-err`;
  const [meta, setMeta] = useState<CompanyCertificateGetResponse | null>(null);
  const [certApiAvailable, setCertApiAvailable] = useState<boolean | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { showToast } = useUiToast();
  const maxMb = clientCertUploadMaxMbHint();

  const refreshMeta = useCallback(async () => {
    setLoadErr(null);
    try {
      const r = await fetch(buildCertificateApiUrl(organizationId, companyId), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (r.status === 404) {
        setMeta(null);
        setCertApiAvailable(false);
        return;
      }
      if (!r.ok) {
        setCertApiAvailable(false);
        setLoadErr("Não foi possível carregar o estado do registo de certificado.");
        return;
      }
      const j = (await r.json()) as CompanyCertificateGetResponse;
      setMeta(j);
      setCertApiAvailable(true);
    } catch {
      setCertApiAvailable(false);
      setLoadErr("Não foi possível carregar o estado do registo de certificado.");
    }
  }, [organizationId, companyId]);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  const onSubmit = useCallback(async () => {
    setFormErr(null);
    setSuccessMsg(null);
    if (!file) {
      setFormErr("Seleccione um ficheiro .pfx ou .p12.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("password", password);
      const r = await fetch(buildCertificateApiUrl(organizationId, companyId), {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (r.status === 204) {
        setPassword("");
        setFile(null);
        const msg = "Certificado registado. O servidor de recolha pode demorar alguns minutos a ficar pronto.";
        setSuccessMsg(msg);
        showToast({
          title: "Certificado registado",
          description: "A infraestrutura de recolha pode levar alguns minutos para aplicar.",
          tone: "success",
        });
        await refreshMeta();
        onRegistered();
        return;
      }
      let code: CertUploadErrorCode | undefined;
      try {
        const j = (await r.json()) as { message?: string; error_code?: CertUploadErrorCode };
        code = j.error_code;
        if (j.message) {
          setFormErr(j.message);
          showToast({ title: "Falha no registo", description: j.message, tone: "error" });
          return;
        }
      } catch {
        /* ignore */
      }
      const msg =
        code ? certUploadMessageForCode(code, maxMb) : "Não foi possível concluir o registo. Tente novamente.";
      setFormErr(msg);
      showToast({ title: "Falha no registo", description: msg, tone: "error" });
    } catch {
      const msg = "Não foi possível concluir o registo. Tente novamente.";
      setFormErr(msg);
      showToast({ title: "Falha no registo", description: msg, tone: "error" });
    } finally {
      setBusy(false);
    }
  }, [file, password, organizationId, companyId, maxMb, onRegistered, refreshMeta, showToast]);

  const onClear = useCallback(() => {
    setFile(null);
    setPassword("");
    setFormErr(null);
    setSuccessMsg(null);
  }, []);

  const cnpjLabel = cnpjDigits.length === 14 ? formatCnpj(cnpjDigits) : cnpjDigits;

  return (
    <fieldset
      aria-labelledby={legendId}
      className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/12"
      aria-busy={busy}
    >
      <legend id={legendId} className="px-1 text-sm font-semibold text-black/90 dark:text-white/90">
        Registo do certificado
      </legend>

      {loadErr ? (
        <p className="mt-2 text-xs text-amber-900 dark:text-amber-200" role="alert">
          {loadErr}
        </p>
      ) : null}

      {certApiAvailable === false ? (
        <p className="mt-2 text-xs text-black/60 dark:text-white/50" role="status">
          O registo de certificado pelo portal está desactivado neste ambiente (o servidor responde 404 ao endpoint).
          Peça à equipa técnica para remover <span className="font-mono">CERT_UPLOAD_API_ENABLED=false</span> ou use o
          guia do servidor de recolha.
        </p>
      ) : null}

      {certApiAvailable === true && meta?.status === "active" && meta.notAfter ? (
        <p className="mt-2 text-xs text-black/70 dark:text-white/65">
          Certificado activo — válido até {meta.notAfter.split("-").reverse().join("/")}
        </p>
      ) : null}

      {successMsg ? (
        <Alert className="mt-3 border-emerald-900/20 bg-emerald-50/80 dark:border-emerald-200/20 dark:bg-emerald-950/25">
          <span
            className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-900/15 text-[10px] font-bold text-emerald-900 dark:bg-emerald-200/15 dark:text-emerald-100"
            aria-hidden="true"
          >
            ✓
          </span>
          <AlertTitle className="text-emerald-950 dark:text-emerald-50">Registo</AlertTitle>
          <AlertDescription className="text-emerald-950/90 dark:text-emerald-50/95">
            <p role="status">{successMsg}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {formErr ? (
        <Alert variant="destructive" className="mt-3 px-3 py-2" id={errId} role="alert">
          <AlertTitle>Envio</AlertTitle>
          <AlertDescription>
            <p>{formErr}</p>
            {formErr.includes("CNPJ") ? (
              <p className="mt-1 text-xs opacity-90">CNPJ da empresa: {cnpjLabel}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {certApiAvailable === true ? (
        <>
          <div className="mt-3 space-y-3">
            <div>
              <label
                htmlFor={`${baseId}-file`}
                className="block text-xs font-medium text-black/80 dark:text-white/75"
              >
                Ficheiro do certificado (.pfx ou .p12)
              </label>
              <input
                id={`${baseId}-file`}
                name="certificateFile"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-black/85 file:mr-3 file:rounded-md file:border file:border-black/15 file:bg-black/[0.04] file:px-3 file:py-2 file:text-sm dark:text-white/85 dark:file:border-white/18 dark:file:bg-white/[0.06]"
              />
              <p className="mt-1 text-xs text-black/50 dark:text-white/45">
                Tamanho máximo: {maxMb} MB (ajustável em servidor).
              </p>
            </div>
            <div>
              <label
                htmlFor={`${baseId}-pw`}
                className="block text-xs font-medium text-black/80 dark:text-white/75"
              >
                Palavra-passe do ficheiro
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  id={`${baseId}-pw`}
                  name="certificatePassword"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(formErr)}
                  aria-describedby={formErr ? errId : undefined}
                  className="min-h-[44px] flex-1 min-w-[12rem] rounded-lg border border-black/12 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-black/30"
                />
                <button
                  type="button"
                  className="rounded-lg border border-black/12 px-3 py-2 text-xs font-medium dark:border-white/15"
                  aria-pressed={showPw}
                  disabled={busy}
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSubmit()}
              className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] min-h-[44px] disabled:opacity-50"
            >
              {busy ? "A enviar…" : "Enviar certificado"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClear}
              className="rounded-lg border border-black/12 px-4 py-2 text-sm dark:border-white/15 min-h-[44px] disabled:opacity-50"
            >
              Limpar
            </button>
          </div>
        </>
      ) : certApiAvailable === null ? (
        <p className="mt-2 text-xs text-black/50 dark:text-white/45" role="status">
          A carregar registo de certificado…
        </p>
      ) : null}
    </fieldset>
  );
}

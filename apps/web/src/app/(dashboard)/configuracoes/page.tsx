"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { usePortal } from "@/context/portal-provider";
import { useAppSession } from "@/context/app-session";
import { MAX_LOCAL_DOWNLOAD_ROOT_LENGTH } from "@/lib/local-download-root";

const ZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Belem",
] as const;

const HELPER_SERVER_PATH_ID = "helper-server-path-ab";
const HELPER_SERVER_PATH_B_ID = "helper-server-path-b";

type AdnSettingsJson = {
  adnSyncEnabled: boolean;
  canManage: boolean;
  localDownloadRoot: string | null;
};

function messageForLocalPathErrorCode(code: string | undefined): string {
  switch (code) {
    case "LOCAL_PATH_TOO_LONG":
      return "O caminho é demasiado longo. Use um caminho mais curto ou uma letra de unidade mais próxima da raiz.";
    case "LOCAL_PATH_INVALID_CHARS":
      return "O caminho contém caracteres não permitidos. Use letras, números e separadores «\\» válidos no Windows.";
    case "LOCAL_PATH_TRAVERSAL":
      return "O caminho não é válido (segmentos «..», UNC ou extended path não suportado).";
    case "LOCAL_PATH_INVALID":
      return "O caminho contém símbolos não permitidos no Windows. Remova caracteres como < > \" | ? *.";
    default:
      return "Não foi possível guardar o caminho. Tente novamente.";
  }
}

export default function ConfiguracoesPage() {
  const { settings, updateSettings } = usePortal();
  const { data: sessionData } = useAppSession();
  const activeOrgId = sessionData?.session.activeOrganizationId ?? null;

  const [notifyEmailOnFailure, setNotifyEmailOnFailure] = useState(
    settings.notifyEmailOnFailure,
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [saved, setSaved] = useState(false);

  const [adnLoading, setAdnLoading] = useState(false);
  const [adnErr, setAdnErr] = useState<string | null>(null);
  const [adnEnabled, setAdnEnabled] = useState(false);
  const [adnDraft, setAdnDraft] = useState(false);
  const [adnCanManage, setAdnCanManage] = useState(false);
  const [adnBusy, setAdnBusy] = useState(false);
  const [adnSaved, setAdnSaved] = useState(false);

  const [serverPathDraft, setServerPathDraft] = useState("");
  const [serverPathSaved, setServerPathSaved] = useState<string | null>(null);
  const [serverPathBusy, setServerPathBusy] = useState(false);
  const [serverPathErr, setServerPathErr] = useState<string | null>(null);
  const [serverPathOk, setServerPathOk] = useState(false);

  const loadAdn = useCallback(async () => {
    if (!activeOrgId) {
      setAdnLoading(false);
      setAdnErr(null);
      return;
    }
    setAdnLoading(true);
    setAdnErr(null);
    setServerPathErr(null);
    try {
      const r = await fetch(`/api/v1/organizations/${activeOrgId}/adn-sync-settings`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        setAdnErr("Não foi possível carregar o estado da sincronização ADN.");
        return;
      }
      const j = (await r.json()) as AdnSettingsJson;
      setAdnEnabled(j.adnSyncEnabled);
      setAdnDraft(j.adnSyncEnabled);
      setAdnCanManage(j.canManage);
      const p = j.localDownloadRoot ?? "";
      setServerPathDraft(p);
      setServerPathSaved(j.localDownloadRoot ?? null);
    } catch {
      setAdnErr("Não foi possível carregar o estado da sincronização ADN.");
    } finally {
      setAdnLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    void loadAdn();
  }, [loadAdn]);

  async function saveAdn() {
    if (!activeOrgId || !adnCanManage) {
      return;
    }
    setAdnBusy(true);
    setAdnErr(null);
    try {
      const r = await fetch(`/api/v1/organizations/${activeOrgId}/adn-sync-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adnSyncEnabled: adnDraft }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { message?: string } | null;
        setAdnErr(j?.message ?? "Não foi possível guardar.");
        return;
      }
      const j = (await r.json()) as { adnSyncEnabled: boolean };
      setAdnEnabled(j.adnSyncEnabled);
      setAdnDraft(j.adnSyncEnabled);
      setAdnSaved(true);
      window.setTimeout(() => setAdnSaved(false), 2500);
    } catch {
      setAdnErr("Não foi possível guardar.");
    } finally {
      setAdnBusy(false);
    }
  }

  async function saveServerPath() {
    if (!activeOrgId || !adnCanManage) {
      return;
    }
    setServerPathBusy(true);
    setServerPathErr(null);
    setServerPathOk(false);
    try {
      const trimmed = serverPathDraft.trim();
      const body =
        trimmed.length === 0 ? { localDownloadRoot: null } : { localDownloadRoot: trimmed };
      const r = await fetch(`/api/v1/organizations/${activeOrgId}/adn-sync-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => null)) as
        | { message?: string; error_code?: string; localDownloadRoot?: string | null }
        | null;
      if (!r.ok) {
        const msg =
          r.status === 400 && j?.error_code
            ? messageForLocalPathErrorCode(j.error_code)
            : (j?.message ?? "Não foi possível guardar. Tente novamente.");
        setServerPathErr(msg);
        return;
      }
      const root = (j?.localDownloadRoot ?? null) as string | null;
      setServerPathSaved(root);
      setServerPathDraft(root ?? "");
      setServerPathOk(true);
      window.setTimeout(() => setServerPathOk(false), 2500);
      updateSettings({
        localRootPath: root && root.length > 0 ? root : settings.localRootPath,
      });
    } catch {
      setServerPathErr("Não foi possível guardar. Tente novamente.");
    } finally {
      setServerPathBusy(false);
    }
  }

  useEffect(() => {
    setNotifyEmailOnFailure(settings.notifyEmailOnFailure);
    setTimezone(settings.timezone);
  }, [settings]);

  function onSubmitBrowserPrefs(e: FormEvent) {
    e.preventDefault();
    updateSettings({
      notifyEmailOnFailure,
      timezone,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  const serverPathDirty =
    (serverPathDraft.trim() || "") !== (serverPathSaved === null ? "" : serverPathSaved.trim());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Preferências da organização activa no servidor e preferências só deste navegador. As definições
          marcadas como servidor aplicam-se à organização activa.
        </p>
      </div>

      <section
        className="max-w-lg space-y-4 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
        aria-labelledby="heading-adn-org"
      >
        <div>
          <h2 id="heading-adn-org" className="text-lg font-semibold tracking-tight">
            Sincronização ADN (organização activa)
          </h2>
          <p className="mt-2 text-xs text-black/55 dark:text-white/50">
            Quando activa, administradores podem enfileirar pedidos reais na página de cada empresa monitorada. O
            processamento no Ambiente Nacional exige um{" "}
            <strong className="font-medium text-black/70 dark:text-white/65">worker</strong> com credenciais e
            variáveis <span className="font-mono text-[11px]">ADN_WORKER_*</span> — ver{" "}
            <code className="rounded bg-black/10 px-1 text-[11px] dark:bg-white/10">docs/qa/adn-staging-setup.md</code>
            .
          </p>
        </div>
        {!activeOrgId ? (
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Escolha uma organização na sessão para ver e editar esta definição.
          </p>
        ) : adnLoading ? (
          <p className="text-xs text-black/50 dark:text-white/45">A carregar…</p>
        ) : adnErr ? (
          <p className="text-sm text-red-700 dark:text-red-300" role="alert">
            {adnErr}
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <input
                id="adnSync"
                type="checkbox"
                checked={adnDraft}
                disabled={!adnCanManage || adnBusy}
                onChange={(e) => setAdnDraft(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-black/20 text-emerald-700 focus:ring-emerald-600 disabled:opacity-50"
              />
              <div>
                <label htmlFor="adnSync" className="text-sm font-medium">
                  Activar sincronização ADN para esta organização
                </label>
                <p className="mt-1 text-xs text-black/55 dark:text-white/50">
                  Estado actual no servidor:{" "}
                  <strong>{adnEnabled ? "activa" : "inactiva"}</strong>.
                  {!adnCanManage ? " Apenas administradores da organização podem alterar." : null}
                </p>
              </div>
            </div>
            {adnCanManage ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={adnBusy || adnDraft === adnEnabled}
                  onClick={() => void saveAdn()}
                  className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-40"
                >
                  {adnBusy ? "A guardar…" : "Guardar ADN"}
                </button>
                {adnSaved ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">Definição guardada.</span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section
        className="max-w-lg space-y-4 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
        aria-labelledby="heading-server-root"
      >
        <h2 id="heading-server-root" className="text-lg font-semibold tracking-tight">
          Pasta raiz no disco (servidor)
        </h2>
        <p id={HELPER_SERVER_PATH_ID} className="text-xs leading-relaxed text-black/55 dark:text-white/50">
          Este caminho não é validado pelo site: o servidor guarda o texto para o worker usar. O worker só
          consegue escrever em pastas do computador onde ele está instalado (em geral, o mesmo onde está o
          certificado e-CNPJ).
        </p>
        <p id={HELPER_SERVER_PATH_B_ID} className="text-xs leading-relaxed text-black/55 dark:text-white/50">
          Se o worker correr noutro ambiente (cloud), defina aqui o caminho nessa máquina ou deixe vazio e use o
          agente local quando estiver disponível. Árvore no disco:{" "}
          <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10">
            {"{root}\\{CNPJ 14 dígitos}\\{código-do-sistema}\\{chave}.xml"}
          </code>{" "}
          e <code className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10">.pdf</code> quando
          existir.
        </p>
        {!activeOrgId ? (
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Escolha uma organização na sessão para ver e editar esta definição.
          </p>
        ) : adnLoading ? (
          <p className="text-xs text-black/50 dark:text-white/45">A carregar…</p>
        ) : (
          <>
            <div>
              <label
                htmlFor="local-download-root"
                className="text-xs font-medium text-black/70 dark:text-white/65"
              >
                Caminho absoluto na máquina do worker
              </label>
              <input
                id="local-download-root"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={MAX_LOCAL_DOWNLOAD_ROOT_LENGTH}
                value={serverPathDraft}
                readOnly={!adnCanManage}
                aria-describedby={`${HELPER_SERVER_PATH_ID} ${HELPER_SERVER_PATH_B_ID}`}
                aria-busy={serverPathBusy}
                onChange={(e) => setServerPathDraft(e.target.value)}
                placeholder="C:\NFs"
                className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15 read-only:opacity-80"
              />
              {!adnCanManage ? (
                <p className="mt-1.5 text-xs text-black/55 dark:text-white/50">
                  Apenas administradores da organização podem alterar este caminho.
                </p>
              ) : null}
            </div>
            {serverPathErr ? (
              <p className="text-sm text-red-700 dark:text-red-300" role="alert">
                {serverPathErr}
              </p>
            ) : null}
            {adnCanManage ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={serverPathBusy || !serverPathDirty}
                  onClick={() => void saveServerPath()}
                  className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-40"
                >
                  {serverPathBusy ? "A guardar…" : "Guardar pasta no servidor"}
                </button>
                {serverPathOk ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">
                    Caminho guardado no servidor.
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      <form
        onSubmit={onSubmitBrowserPrefs}
        className="max-w-lg space-y-6 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
        aria-labelledby="heading-browser-prefs"
      >
        <div>
          <h2 id="heading-browser-prefs" className="text-lg font-semibold tracking-tight">
            Preferências neste navegador
          </h2>
          <p className="mt-2 text-xs text-black/55 dark:text-white/50">
            Fuso horário e alertas abaixo aplicam-se apenas a este dispositivo e não são enviados ao servidor.
          </p>
        </div>

        <div>
          <label
            htmlFor="tz"
            className="text-xs font-medium text-black/70 dark:text-white/65"
          >
            Fuso horário (agendamento dia 1º)
          </label>
          <select
            id="tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z.replace("America/", "")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="notify"
            type="checkbox"
            checked={notifyEmailOnFailure}
            onChange={(e) => setNotifyEmailOnFailure(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-black/20 text-emerald-700 focus:ring-emerald-600"
          />
          <div>
            <label htmlFor="notify" className="text-sm font-medium">
              Notificar por e-mail em caso de falha
            </label>
            <p className="mt-1 text-xs text-black/55 dark:text-white/50">
              Fase 2: integração com provedor de e-mail. Aqui apenas persiste a preferência.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
          >
            Guardar preferências locais
          </button>
          {saved ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              Preferências salvas neste navegador.
            </span>
          ) : null}
        </div>
      </form>

      <section className="max-w-lg rounded-xl border border-black/5 p-5 text-sm text-black/65 dark:border-white/10 dark:text-white/60">
        <h2 className="font-semibold text-[var(--foreground)]">
          Segurança e LGPD
        </h2>
        <p className="mt-2 leading-relaxed">
          Credenciais de portais e notas fiscais exigem criptografia em trânsito e em repouso; esta interface é um
          protótipo funcional. Produção deve usar cofre de segredos e auditoria de acesso.
        </p>
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { usePortal } from "@/context/portal-provider";
import { useAppSession } from "@/context/app-session";

const ZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Belem",
] as const;

export default function ConfiguracoesPage() {
  const { settings, updateSettings } = usePortal();
  const { data: sessionData } = useAppSession();
  const activeOrgId = sessionData?.session.activeOrganizationId ?? null;

  const [localRootPath, setLocalRootPath] = useState(settings.localRootPath);
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

  const loadAdn = useCallback(async () => {
    if (!activeOrgId) {
      setAdnLoading(false);
      setAdnErr(null);
      return;
    }
    setAdnLoading(true);
    setAdnErr(null);
    try {
      const r = await fetch(`/api/v1/organizations/${activeOrgId}/adn-sync-settings`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        setAdnErr("Não foi possível carregar o estado da sincronização ADN.");
        return;
      }
      const j = (await r.json()) as { adnSyncEnabled: boolean; canManage: boolean };
      setAdnEnabled(j.adnSyncEnabled);
      setAdnDraft(j.adnSyncEnabled);
      setAdnCanManage(j.canManage);
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

  useEffect(() => {
    setLocalRootPath(settings.localRootPath);
    setNotifyEmailOnFailure(settings.notifyEmailOnFailure);
    setTimezone(settings.timezone);
  }, [settings]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    updateSettings({
      localRootPath: localRootPath.trim() || "C:\\NFs",
      notifyEmailOnFailure,
      timezone,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Preferências de pasta local, fuso e alertas — alinhadas ao brief de
          produto (agente desktop + rotina mensal).
        </p>
      </div>

      <section className="max-w-lg space-y-4 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sincronização ADN (organização activa)</h2>
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

      <form
        onSubmit={onSubmit}
        className="max-w-lg space-y-6 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
      >
        <div>
          <label
            htmlFor="root"
            className="text-xs font-medium text-black/70 dark:text-white/65"
          >
            Pasta raiz no Windows
          </label>
          <input
            id="root"
            value={localRootPath}
            onChange={(e) => setLocalRootPath(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          />
          <p className="mt-1.5 text-xs text-black/50 dark:text-white/45">
            O agente local criará subpastas{" "}
            <code className="rounded bg-black/10 px-1 dark:bg-white/10">
              CNPJ\código-do-sistema
            </code>{" "}
            abaixo desta raiz.
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
              Fase 2: integração com provedor de e-mail. Aqui apenas persiste a
              preferência.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
          >
            Salvar
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
          Credenciais de portais e notas fiscais exigem criptografia em trânsito
          e em repouso; esta interface é um protótipo funcional. Produção deve
          usar cofre de segredos e auditoria de acesso.
        </p>
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePortal } from "@/context/portal-provider";

const ZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Belem",
] as const;

export default function ConfiguracoesPage() {
  const { settings, updateSettings } = usePortal();
  const [localRootPath, setLocalRootPath] = useState(settings.localRootPath);
  const [notifyEmailOnFailure, setNotifyEmailOnFailure] = useState(
    settings.notifyEmailOnFailure,
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [saved, setSaved] = useState(false);

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

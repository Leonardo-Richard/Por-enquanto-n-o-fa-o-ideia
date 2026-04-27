"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useId, useState } from "react";
import { formatCnpj, isValidCnpj, sanitizeCnpj } from "@repo/shared";
import type { Company } from "@repo/shared";
import { buildWelcomeExecution, usePortal } from "@/context/portal-provider";
import { useAppSession } from "@/context/app-session";

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

export function CompanyForm() {
  const { appendExecution } = usePortal();
  const { refetch } = useAppSession();
  const router = useRouter();
  const monthlyHelpId = useId();
  const [cnpj, setCnpj] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [systemCode, setSystemCode] = useState("");
  const [monthlyRunDay, setMonthlyRunDay] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = sanitizeCnpj(cnpj);
    if (!isValidCnpj(digits)) {
      setError("CNPJ inválido. Confira os dígitos.");
      return;
    }
    if (!systemCode.trim()) {
      setError("Informe o código do sistema de origem.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/companies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpjDigits: digits,
          tradeName,
          systemCode,
          monthlyRunDay,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { company?: Company; error?: { message?: string } }
        | null;
      if (!res.ok) {
        setError(body?.error?.message ?? "Não foi possível guardar.");
        return;
      }
      const company = body?.company;
      if (!company) {
        setError("Resposta inválida do servidor.");
        return;
      }
      appendExecution(buildWelcomeExecution(company));
      await fetch("/api/v1/session/active-company", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      await refetch(true);
      router.push(`/empresas/${company.id}`);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className="space-y-5 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div>
        <label htmlFor="cnpj" className="text-xs font-medium text-black/70 dark:text-white/65">
          CNPJ
        </label>
        <input
          id="cnpj"
          inputMode="numeric"
          autoComplete="off"
          value={formatCnpj(sanitizeCnpj(cnpj))}
          onChange={(e) => setCnpj(sanitizeCnpj(e.target.value))}
          placeholder="00.000.000/0000-00"
          className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 font-mono text-sm tabular-nums outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
        />
      </div>
      <div>
        <label
          htmlFor="tradeName"
          className="text-xs font-medium text-black/70 dark:text-white/65"
        >
          Nome fantasia{" "}
          <span className="font-normal text-black/45 dark:text-white/45">
            (opcional)
          </span>
        </label>
        <input
          id="tradeName"
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
        />
      </div>
      <div>
        <label
          htmlFor="systemCode"
          className="text-xs font-medium text-black/70 dark:text-white/65"
        >
          Código do sistema
        </label>
        <input
          id="systemCode"
          required
          value={systemCode}
          onChange={(e) => setSystemCode(e.target.value)}
          placeholder="Ex.: sefaz-sp, prefeitura-xyz"
          className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
        />
        <p className="mt-1.5 text-xs text-black/50 dark:text-white/45">
          Identifica a origem lógica das notas; vira segmento de pasta no disco.
        </p>
      </div>
      <div>
        <label
          htmlFor="monthlyRunDay"
          className="text-xs font-medium text-black/70 dark:text-white/65"
        >
          Dia da coleta mensal
        </label>
        <select
          id="monthlyRunDay"
          aria-describedby={monthlyHelpId}
          value={monthlyRunDay}
          onChange={(e) => setMonthlyRunDay(Number(e.target.value))}
          className="mt-1.5 w-full max-w-xs rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <p
          id={monthlyHelpId}
          className="mt-1.5 text-xs text-black/50 dark:text-white/45"
        >
          A coleta recorrente corre às <strong>06:00</strong> no fuso{" "}
          <strong>América/São Paulo</strong>. Escolha o dia civil (1 a 28) em que
          quer que o job mensal seja agendado.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "A guardar…" : "Salvar e abrir detalhes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/15 px-5 text-sm font-medium dark:border-white/20"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

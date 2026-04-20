"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { formatCnpj, isValidCnpj, sanitizeCnpj } from "@repo/shared";
import { usePortal } from "@/context/portal-provider";

export function CompanyForm() {
  const { addCompany } = usePortal();
  const router = useRouter();
  const [cnpj, setCnpj] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [systemCode, setSystemCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
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
    const company = addCompany({
      cnpjDigits: digits,
      tradeName,
      systemCode,
    });
    router.push(`/empresas/${company.id}`);
  }

  return (
    <form
      onSubmit={onSubmit}
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

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Salvar e abrir detalhes
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

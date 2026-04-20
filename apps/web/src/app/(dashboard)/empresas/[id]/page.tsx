"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatCnpj } from "@repo/shared";
import { usePortal } from "@/context/portal-provider";

export default function EmpresaDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { companies, pathForCompany, runSync, updateCompany, removeCompany } =
    usePortal();
  const router = useRouter();

  const company = useMemo(
    () => companies.find((c) => c.id === id),
    [companies, id],
  );

  const [tradeName, setTradeName] = useState("");
  const [systemCode, setSystemCode] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (company) {
      setTradeName(company.tradeName);
      setSystemCode(company.systemCode);
      setDirty(false);
    }
  }, [company]);

  if (!company) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-black/65 dark:text-white/60">
          Empresa não encontrada.
        </p>
        <Link
          href="/empresas"
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          Voltar à lista
        </Link>
      </div>
    );
  }

  const comp = company;
  const path = pathForCompany(comp);

  function save() {
    updateCompany(comp.id, {
      tradeName,
      systemCode,
    });
    setDirty(false);
  }

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/empresas"
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Empresas
        </Link>
        <h1 className="mt-4 font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {formatCnpj(comp.cnpjDigits)}
        </h1>
        <p className="mt-1 text-xs text-black/50 dark:text-white/45">
          Cadastrada em{" "}
          {new Date(comp.createdAt).toLocaleString("pt-BR")}
        </p>
      </div>

      <section className="rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="text-sm font-semibold">Pasta local prevista</h2>
        <p className="mt-2 break-all font-mono text-xs leading-relaxed text-black/75 dark:text-white/70">
          {path}
        </p>
        <p className="mt-3 text-xs text-black/55 dark:text-white/50">
          Raiz configurável em Configurações. Caracteres inválidos no código do
          sistema são normalizados para o caminho.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Dados</h2>
        <div>
          <label
            htmlFor="tradeName"
            className="text-xs font-medium text-black/70 dark:text-white/65"
          >
            Nome fantasia
          </label>
          <input
            id="tradeName"
            value={tradeName}
            onChange={(e) => {
              setTradeName(e.target.value);
              setDirty(true);
            }}
            className="mt-1.5 w-full max-w-md rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
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
            value={systemCode}
            onChange={(e) => {
              setSystemCode(e.target.value);
              setDirty(true);
            }}
            className="mt-1.5 w-full max-w-md rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dirty}
            onClick={save}
            className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Salvar alterações
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runSync(comp.id, "manual")}
          className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-900 dark:text-emerald-100"
        >
          Sincronizar agora
        </button>
        <button
          type="button"
          onClick={() => runSync(comp.id, "monthly")}
          className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/15"
        >
          Simular job do dia 1º
        </button>
      </section>

      <section className="border-t border-black/5 pt-8 dark:border-white/10">
        <button
          type="button"
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              window.confirm(
                "Remover esta empresa e o histórico de execuções associado neste navegador?",
              )
            ) {
              removeCompany(comp.id);
              router.push("/empresas");
            }
          }}
          className="text-sm text-red-600 hover:underline dark:text-red-400"
        >
          Excluir empresa…
        </button>
      </section>
    </div>
  );
}

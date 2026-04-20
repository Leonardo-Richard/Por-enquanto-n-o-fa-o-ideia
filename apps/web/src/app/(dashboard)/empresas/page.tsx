"use client";

import Link from "next/link";
import { formatCnpj } from "@repo/shared";
import { usePortal } from "@/context/portal-provider";

export default function EmpresasPage() {
  const { companies } = usePortal();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="mt-2 text-sm text-black/65 dark:text-white/60">
            Cada registro combina CNPJ (somente dígitos) e o código do sistema de
            origem das notas.
          </p>
        </div>
        <Link
          href="/empresas/nova"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Nova empresa
        </Link>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="text-sm text-black/65 dark:text-white/60">
            Nenhuma empresa ainda. Comece pelo cadastro para ver a pasta local
            prevista e disparar a primeira coleta.
          </p>
          <Link
            href="/empresas/nova"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-black/15 px-4 text-sm font-medium dark:border-white/20"
          >
            Cadastrar primeira empresa
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-black/5 rounded-xl border border-black/5 dark:divide-white/10 dark:border-white/10">
          {companies.map((c) => (
            <li key={c.id}>
              <Link
                href={`/empresas/${c.id}`}
                className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-black/[0.02] sm:flex-row sm:items-center sm:justify-between dark:hover:bg-white/[0.03]"
              >
                <div>
                  <p className="font-medium tabular-nums">{formatCnpj(c.cnpjDigits)}</p>
                  <p className="text-sm text-black/60 dark:text-white/55">
                    {c.tradeName || "Sem nome fantasia"} · código{" "}
                    <span className="font-mono text-xs">{c.systemCode}</span>
                  </p>
                </div>
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  Abrir detalhes →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { formatCnpj, messageFromMonthlyRunDayParse, type Company } from "@repo/shared";
import { usePortal } from "@/context/portal-provider";
import { useAppSession } from "@/context/app-session";

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function EmpresaDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { pathForCompany, runSync } = usePortal();
  const { refetch } = useAppSession();
  const router = useRouter();
  const monthlyHelpId = useId();
  const monthlyRunDayErrorId = useId();

  const [company, setCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tradeName, setTradeName] = useState("");
  const [systemCode, setSystemCode] = useState("");
  const [monthlyRunDay, setMonthlyRunDay] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      const res = await fetch(`/api/v1/companies/${id}`, { credentials: "include" });
      if (!res.ok) {
        if (!cancelled) {
          setLoadError("Empresa não encontrada ou sem acesso.");
          setCompany(null);
        }
        return;
      }
      const body = (await res.json()) as { company: Company };
      if (cancelled) {
        return;
      }
      setCompany(body.company);
      setTradeName(body.company.tradeName);
      setSystemCode(body.company.systemCode);
      setMonthlyRunDay(body.company.monthlyRunDay);
      setDirty(false);
      setFieldError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadError || !company) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-black/65 dark:text-white/60">
          {loadError ?? "A carregar…"}
        </p>
        <Link
          href="/empresas"
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          Voltar ao picker
        </Link>
      </div>
    );
  }

  const comp = company;
  const path = pathForCompany(comp);

  async function save() {
    setFieldError(null);
    const monthlyErr = messageFromMonthlyRunDayParse(monthlyRunDay);
    if (monthlyErr) {
      setFieldError(monthlyErr);
      return;
    }
    const res = await fetch(`/api/v1/companies/${comp.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradeName,
        systemCode,
        monthlyRunDay,
      }),
    });
    if (!res.ok) {
      setFieldError("Não foi possível guardar.");
      return;
    }
    const body = (await res.json()) as { company: Company };
    setCompany(body.company);
    setDirty(false);
  }

  async function remove() {
    if (
      typeof window === "undefined" ||
      !window.confirm(
        "Remover esta empresa da plataforma? Os vínculos de membros serão removidos.",
      )
    ) {
      return;
    }
    const res = await fetch(`/api/v1/companies/${comp.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      window.alert("Sem permissão ou erro ao remover.");
      return;
    }
    await refetch(true);
    router.push("/empresas");
  }

  const monthlySelectDescribedBy = fieldError
    ? `${monthlyHelpId} ${monthlyRunDayErrorId}`
    : monthlyHelpId;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/empresas"
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Empresas
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
            {formatCnpj(comp.cnpjDigits)}
          </h1>
          <Link
            href={`/empresas/${comp.id}/usuarios`}
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Utilizadores →
          </Link>
        </div>
        <p className="mt-1 text-xs text-black/50 dark:text-white/45">
          Cadastrada em {new Date(comp.createdAt).toLocaleString("pt-BR")}
        </p>
        <p className="mt-4 max-w-xl text-sm text-black/70 dark:text-white/65">
          Coleta automática mensal: dia <strong>{comp.monthlyRunDay}</strong>, às
          06:00 (América/São Paulo).
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
        <div>
          <label
            htmlFor="monthlyRunDay"
            className="text-xs font-medium text-black/70 dark:text-white/65"
          >
            Dia da coleta mensal
          </label>
          <select
            id="monthlyRunDay"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={monthlySelectDescribedBy}
            value={monthlyRunDay}
            onChange={(e) => {
              setMonthlyRunDay(Number(e.target.value));
              setDirty(true);
              setFieldError(null);
            }}
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
            <strong>América/São Paulo</strong>.
          </p>
        </div>
        {fieldError ? (
          <p
            id={monthlyRunDayErrorId}
            className="text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {fieldError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dirty}
            onClick={() => void save()}
            className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Salvar alterações
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runSync(comp.id, "manual", comp.cnpjDigits)}
          className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-900 dark:text-emerald-100"
        >
          Sincronizar agora
        </button>
        <button
          type="button"
          onClick={() => runSync(comp.id, "monthly", comp.cnpjDigits)}
          className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/15"
        >
          Simular coleta mensal (dia {comp.monthlyRunDay})
        </button>
      </section>

      <section className="border-t border-black/5 pt-8 dark:border-white/10">
        <button
          type="button"
          onClick={() => void remove()}
          className="text-sm text-red-600 hover:underline dark:text-red-400"
        >
          Excluir empresa…
        </button>
      </section>
    </div>
  );
}

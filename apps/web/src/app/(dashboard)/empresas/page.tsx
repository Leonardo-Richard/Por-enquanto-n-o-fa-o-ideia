"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAccessibleCompanies } from "@/hooks/use-accessible-companies";
import { useAppSession } from "@/context/app-session";
import {
  classifyThrownFetchError,
  FE_API_COPY,
  messageForFailedResponse,
  type FeApiFailureKind,
} from "@/lib/fe-api-error";

type MeIssue = { kind: FeApiFailureKind; message: string } | null;

function PickerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = useMemo(() => searchParams.get("next") ?? "", [searchParams]);
  const searchLabelId = useId();
  const { companies, loading, issue: companiesIssue, reload: reloadCompanies } = useAccessibleCompanies();
  const { refetch: refetchSession } = useAppSession();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [me, setMe] = useState<{ isSuperadmin: boolean } | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meIssue, setMeIssue] = useState<MeIssue>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  const loadMe = useCallback(async () => {
    setMeLoading(true);
    setMeIssue(null);
    try {
      const res = await fetch("/api/v1/me", { credentials: "include" });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const { kind, text } = messageForFailedResponse(res.status, body);
        setMeIssue({ kind, message: text });
        setMe(null);
        return;
      }
      const parsed = body as { isSuperadmin?: boolean };
      setMe({ isSuperadmin: Boolean(parsed.isSuperadmin) });
    } catch (e) {
      const net = classifyThrownFetchError(e);
      if (net === "network") {
        setMeIssue({ kind: "network", message: FE_API_COPY.network });
      } else {
        setMeIssue({ kind: "5xx", message: FE_API_COPY.service5xx });
      }
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const combinedIssue =
    [meIssue, companiesIssue].find((i) => i?.kind === "401") ??
    [meIssue, companiesIssue].find((i) => i?.kind === "403") ??
    meIssue ??
    companiesIssue ??
    null;

  useEffect(() => {
    if (combinedIssue?.kind === "401") {
      router.replace(`/login?next=${encodeURIComponent(nextParam || "/empresas")}`);
    }
  }, [combinedIssue?.kind, nextParam, router]);

  const showRetry =
    combinedIssue !== null &&
    combinedIssue.kind !== "401" &&
    combinedIssue.kind !== "403";

  useEffect(() => {
    if (!showRetry) {
      return;
    }
    const id = requestAnimationFrame(() => {
      retryButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [showRetry, combinedIssue?.message]);

  useEffect(() => {
    if (loading || !companies) {
      return;
    }
    if (companies.length === 1) {
      const only = companies[0]!.id;
      void (async () => {
        await fetch("/api/v1/session/active-company", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: only }),
        });
        await refetchSession(true);
        router.replace(nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard");
      })();
    }
  }, [loading, companies, router, nextParam, refetchSession]);

  async function openCompany(id: string) {
    setBusyId(id);
    try {
      await fetch("/api/v1/session/active-company", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id }),
      });
      await refetchSession(true);
      router.replace(nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard");
    } finally {
      setBusyId(null);
    }
  }

  const filtered =
    companies?.filter((c) => {
      if (!q.trim()) {
        return true;
      }
      const n = q.trim().toLowerCase();
      return (
        c.tradeName.toLowerCase().includes(n) ||
        c.cnpjMasked.toLowerCase().includes(n) ||
        c.systemCode.toLowerCase().includes(n)
      );
    }) ?? [];

  if (loading || meLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-black/5 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (combinedIssue && combinedIssue.kind !== "401") {
    const is403 = combinedIssue.kind === "403";
    return (
      <div
        className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-800 dark:text-red-100"
        role="alert"
        aria-live="polite"
      >
        <p>{combinedIssue.message}</p>
        {!is403 ? (
          <button
            ref={retryButtonRef}
            type="button"
            aria-label={FE_API_COPY.retryAriaLabel}
            onClick={() => {
              void loadMe();
              void reloadCompanies();
            }}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)]"
          >
            Tentar novamente
          </button>
        ) : (
          <p className="mt-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-emerald-800 underline dark:text-emerald-300"
            >
              Voltar ao painel
            </Link>
          </p>
        )}
      </div>
    );
  }

  if (combinedIssue?.kind === "401") {
    return (
      <p className="text-sm text-black/65 dark:text-white/60" role="status" aria-live="polite">
        A redirecionar para o início de sessão…
      </p>
    );
  }

  if (companies && companies.length === 1) {
    return (
      <p className="text-sm text-black/60 dark:text-white/55" role="status">
        A definir empresa única…
      </p>
    );
  }

  const emptyNonSuper = companies && companies.length === 0 && me && !me.isSuperadmin;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Escolha sua Empresa</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Pesquise pelo nome ou CNPJ e abra o contexto em que deseja trabalhar.
        </p>
      </div>

      {emptyNonSuper ? (
        <p className="text-sm text-black/65 dark:text-white/60">
          Não tem acesso a nenhuma empresa. Peça a um administrador para o convidar.
        </p>
      ) : null}

      <div className="max-w-md space-y-2">
        <label htmlFor="q-emp" id={searchLabelId} className="text-xs font-medium text-black/70 dark:text-white/65">
          Pesquisar empresas
        </label>
        <input
          id="q-emp"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-labelledby={searchLabelId}
          className="w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          placeholder="Nome, CNPJ ou código"
        />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {filtered.map((c) => (
          <li
            key={c.id}
            className="flex flex-col rounded-xl border border-black/5 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <p className="font-medium">{c.tradeName}</p>
            <p className="mt-1 font-mono text-xs text-black/60 tabular-nums dark:text-white/55">
              {c.cnpjMasked}
            </p>
            <p className="mt-1 text-xs text-black/50 dark:text-white/45">
              {c.memberCount} membro(s)
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => void openCompany(c.id)}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 text-xs font-medium text-[var(--background)] disabled:opacity-50"
              >
                {busyId === c.id ? "A abrir…" : "Acessar"}
              </button>
              {c.canOpenCompanyAdmin ? (
                <Link
                  href={`/empresas/${c.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-black/15 px-4 text-xs font-medium dark:border-white/20"
                >
                  Admin
                </Link>
              ) : null}
              {c.canManageUsers ? (
                <Link
                  href={`/empresas/${c.id}/usuarios`}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-black/15 px-4 text-xs font-medium dark:border-white/20"
                >
                  Utilizadores
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-sm">
        <Link href="/empresas/nova" className="font-medium text-emerald-700 dark:text-emerald-400">
          Nova empresa
        </Link>
      </p>
    </div>
  );
}

export default function EmpresasPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-black/60 dark:text-white/55">Carregando…</div>
      }
    >
      <PickerInner />
    </Suspense>
  );
}

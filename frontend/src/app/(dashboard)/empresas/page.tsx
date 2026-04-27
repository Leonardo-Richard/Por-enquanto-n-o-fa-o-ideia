"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAccessibleOrganizations } from "@/hooks/use-accessible-organizations";
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
  const {
    organizations,
    loading,
    issue: companiesIssue,
    reload: reloadCompanies,
  } = useAccessibleOrganizations();
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
    if (loading || !organizations) {
      return;
    }
    if (organizations.length === 1) {
      const only = organizations[0]!.id;
      void (async () => {
        await fetch("/api/v1/session/active-organization", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: only }),
        });
        await refetchSession(true);
        router.replace(nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard");
      })();
    }
  }, [loading, organizations, router, nextParam, refetchSession]);

  async function openOrganization(id: string) {
    setBusyId(id);
    try {
      await fetch("/api/v1/session/active-organization", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: id }),
      });
      await refetchSession(true);
      router.replace(nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard");
    } finally {
      setBusyId(null);
    }
  }

  const filtered =
    organizations?.filter((o) => {
      if (!q.trim()) {
        return true;
      }
      const n = q.trim().toLowerCase();
      return (
        o.name.toLowerCase().includes(n) ||
        (o.tradeName?.toLowerCase().includes(n) ?? false) ||
        (o.taxIdMasked?.toLowerCase().includes(n) ?? false)
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

  if (organizations && organizations.length === 1) {
    return (
      <p className="text-sm text-black/60 dark:text-white/55" role="status">
        A definir organização única…
      </p>
    );
  }

  const emptyNonSuper = organizations && organizations.length === 0 && me && !me.isSuperadmin;

  return (
    <div className="space-y-8">
      <LegacyEmpresasRouteBanner />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Escolha sua organização</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Pesquise pelo nome da organização e abra o contexto em que deseja trabalhar.
        </p>
      </div>

      {emptyNonSuper ? (
        <p className="text-sm text-black/65 dark:text-white/60">
          Não tem acesso a nenhuma organização. Peça a um administrador para o convidar.
        </p>
      ) : null}

      <div className="max-w-md space-y-2">
        <label htmlFor="q-emp" id={searchLabelId} className="text-xs font-medium text-black/70 dark:text-white/65">
          Pesquisar organizações
        </label>
        <input
          id="q-emp"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-labelledby={searchLabelId}
          className="w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          placeholder="Nome ou CNPJ da organização"
        />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {filtered.map((o) => (
          <li
            key={o.id}
            className="flex flex-col rounded-xl border border-black/5 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <p className="font-medium">{o.name}</p>
            {o.tradeName ? (
              <p className="mt-1 text-xs text-black/55 dark:text-white/50">{o.tradeName}</p>
            ) : null}
            {o.taxIdMasked ? (
              <p className="mt-1 font-mono text-xs text-black/60 tabular-nums dark:text-white/55">
                {o.taxIdMasked}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-black/50 dark:text-white/45">
              {o.memberCount} membro(s)
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === o.id}
                onClick={() => void openOrganization(o.id)}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 text-xs font-medium text-[var(--background)] disabled:opacity-50"
              >
                {busyId === o.id ? "A abrir…" : "Acessar"}
              </button>
              {o.canOpenOrgAdmin ? (
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-black/15 px-4 text-xs font-medium dark:border-white/20"
                >
                  Painel
                </Link>
              ) : null}
              {o.canManageUsers ? (
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-black/15 px-4 text-xs font-medium dark:border-white/20"
                >
                  Empresas monitoradas
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-sm">
        <Link href="/empresas/nova" className="font-medium text-emerald-700 dark:text-emerald-400">
          Nova empresa monitorada
        </Link>
      </p>
    </div>
  );
}

const BANNER_KEY = "org-fiscal-copy-v1";

function LegacyEmpresasRouteBanner() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(BANNER_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed) {
    return null;
  }
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50"
      role="status"
    >
      <p>
        Esta rota passou a ser o contexto de <strong>organização</strong>. As empresas com CNPJ monitorado ficam no
        painel após escolher a organização.
      </p>
      <button
        type="button"
        className="self-end text-xs font-medium underline"
        onClick={() => {
          try {
            window.localStorage.setItem(BANNER_KEY, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
      >
        Entendi, ocultar
      </button>
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

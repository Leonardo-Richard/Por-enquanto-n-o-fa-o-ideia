"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAccessibleOrganizations } from "@/hooks/use-accessible-organizations";
import { useAppSession } from "@/context/app-session";
import {
  classifyThrownFetchError,
  FE_API_COPY,
  messageForFailedResponse,
  type FeApiFailureKind,
} from "@/lib/fe-api-error";
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog";

type MeIssue = { kind: FeApiFailureKind; message: string } | null;

export function OrganizationsAdminPage() {
  const router = useRouter();
  const searchLabelId = useId();
  const postCreateRef = useRef<HTMLDivElement>(null);
  const { organizations, loading, issue: orgIssue, reload } = useAccessibleOrganizations();
  const { refetch: refetchSession } = useAppSession();
  const [q, setQ] = useState("");
  const [me, setMe] = useState<{ isSuperadmin: boolean } | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meIssue, setMeIssue] = useState<MeIssue>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyAccessId, setBusyAccessId] = useState<string | null>(null);
  const [postCreate, setPostCreate] = useState<{
    id: string;
    localAdminLinked: boolean;
    name: string;
  } | null>(null);

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
    [meIssue, orgIssue].find((i) => i?.kind === "401") ??
    [meIssue, orgIssue].find((i) => i?.kind === "403") ??
    meIssue ??
    orgIssue ??
    null;

  useEffect(() => {
    if (combinedIssue?.kind === "401") {
      router.replace(`/login?next=${encodeURIComponent("/admin/organizacoes")}`);
    }
  }, [combinedIssue?.kind, router]);

  useEffect(() => {
    if (postCreate) {
      const id = requestAnimationFrame(() => postCreateRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [postCreate]);

  async function accessNow(organizationId: string) {
    setBusyAccessId(organizationId);
    try {
      const res = await fetch("/api/v1/session/active-organization", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/admin/organizacoes")}`);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as unknown;
        const { kind, text } = messageForFailedResponse(res.status, body);
        setMeIssue({ kind, message: text });
        return;
      }
      await refetchSession(true);
      setPostCreate(null);
      router.replace("/dashboard");
    } finally {
      setBusyAccessId(null);
    }
  }

  if (loading || meLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-40 animate-pulse rounded-xl border border-black/5 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06]" />
      </div>
    );
  }

  if (combinedIssue && combinedIssue.kind !== "401") {
    return (
      <div
        className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-800 dark:text-red-100"
        role="alert"
        aria-live="polite"
      >
        <p>{combinedIssue.message}</p>
        <p className="mt-4">
          <Link href="/dashboard" className="font-medium text-emerald-800 underline dark:text-emerald-300">
            Voltar ao painel
          </Link>
        </p>
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

  if (!me?.isSuperadmin) {
    return (
      <div
        className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-6 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50"
        role="alert"
        aria-live="polite"
      >
        <p className="font-medium">Acesso negado</p>
        <p className="mt-2 text-black/80 dark:text-white/80">
          Esta área é reservada a administradores da plataforma.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-emerald-800 underline dark:text-emerald-300"
        >
          Voltar ao painel
        </Link>
      </div>
    );
  }

  const filtered =
    organizations?.filter((o) => {
      if (!q.trim()) return true;
      const n = q.trim().toLowerCase();
      return (
        o.name.toLowerCase().includes(n) ||
        (o.tradeName?.toLowerCase().includes(n) ?? false) ||
        (o.taxIdMasked?.toLowerCase().includes(n) ?? false)
      );
    }) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizações</h1>
          <p className="mt-2 text-sm text-black/65 dark:text-white/60">
            Crie organizações e aceda ao contexto para continuar o onboarding.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/admin/operacao" className="font-medium text-emerald-800 underline dark:text-emerald-300">
              Operação (métricas MVP)
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)]"
        >
          Nova organização
        </button>
      </div>

      {postCreate ? (
        <div
          ref={postCreateRef}
          tabIndex={-1}
          className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-50"
          role="status"
          aria-live="polite"
        >
          <p>
            Organização <span className="font-medium">{postCreate.name}</span> criada com sucesso.
          </p>
          {!postCreate.localAdminLinked ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50">
              Organização criada sem administrador local vinculado. Vincule um admin para concluir o onboarding.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busyAccessId === postCreate.id}
            onClick={() => void accessNow(postCreate.id)}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] disabled:opacity-50"
          >
            {busyAccessId === postCreate.id ? "A abrir…" : "Acessar agora"}
          </button>
        </div>
      ) : null}

      <div className="max-w-md space-y-2">
        <label htmlFor="q-org-admin" id={searchLabelId} className="text-xs font-medium text-black/70 dark:text-white/65">
          Buscar organizações
        </label>
        <input
          id="q-org-admin"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-labelledby={searchLabelId}
          placeholder="Buscar organizações…"
          className="w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
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
              <p className="mt-1 font-mono text-xs text-black/60 tabular-nums dark:text-white/55">{o.taxIdMasked}</p>
            ) : null}
            <p className="mt-1 text-xs text-black/50 dark:text-white/45">{o.memberCount} membro(s)</p>
            <Link
              href={`/admin/organizacoes/${o.id}/membros`}
              className="mt-3 inline-flex text-sm font-medium text-emerald-800 underline dark:text-emerald-300"
            >
              Gerir membros
            </Link>
          </li>
        ))}
      </ul>

      <CreateOrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(body) => {
          setPostCreate({
            id: body.id,
            localAdminLinked: body.localAdminLinked,
            name: body.name,
          });
          void reload();
        }}
      />
    </div>
  );
}

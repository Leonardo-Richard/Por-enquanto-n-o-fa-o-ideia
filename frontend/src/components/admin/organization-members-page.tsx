"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { fetchOrganizationSystemUserCatalog } from "@/lib/fetch-organization-system-user-catalog";
import { FE_API_COPY, messageForFailedResponse, type FeApiFailureKind } from "@/lib/fe-api-error";
import type { OrganizationDirectoryUserItem, OrganizationMemberListItem } from "@repo/shared";

/** Copy PT-BR (spec UX §10 — chaves `mem.catalog.*` para rastreio i18n). */
const mem = {
  backToOrganizations: "Voltar às organizações",
  listTitle: "Membros",
  listSubtitle: (name: string) => `Organização: ${name}`,
  searchLabel: "Filtrar por nome ou e-mail",
  searchPlaceholder: "Filtra à medida que escreve…",
  emptySystem: "Ainda não há utilizadores no sistema.",
  emptyFilter: "Nenhum utilizador corresponde ao filtro.",
  paginationStatus: (pageNum: number, visibleTotal: number) =>
    `Página ${pageNum} · ${visibleTotal} utilizador(es) visíveis`,
  truncationWarning: (maxLoaded: number) =>
    `Lista truncada: foram carregados no máximo ${maxLoaded} utilizadores. Refine operações ou contacte suporte.`,
  catalogRefetchRetry: "Tentar novamente",
  liveRegionResults: (count: number) => `${count} resultados`,
  tableSuperadmin: "Superadmin",
  tableInOrg: "Nesta organização",
  inOrgYes: "Membro",
  inOrgNo: "—",
  rowAddToOrg: "Adicionar à organização",
  ctaAddExisting: "Adicionar membro existente",
  ctaCreateUser: "Criar utilizador e adicionar",
  roleAdmin: "Administrador da organização",
  roleUser: "Utilizador da organização",
  tableUser: "Utilizador",
  tableRole: "Papel",
  tableJob: "Cargo",
  tableDept: "Departamento",
  tablePhone: "Contato",
  tableActions: "Acções",
  rowEdit: "Editar",
  rowRemove: "Remover vínculo",
  superadminYes: "Sim",
  superadminNo: "Não",
  addExistingTitle: "Adicionar membro existente",
  addExistingSubmit: "Adicionar à organização",
  createUserTitle: "Criar utilizador e adicionar",
  createUserSubmit: "Criar e associar",
  editTitle: "Editar membro",
  editSubmit: "Guardar alterações",
  removeTitle: "Remover vínculo com esta organização?",
  removeBody:
    "O utilizador deixa de ter acesso a esta organização. A conta global não é eliminada.",
  removeCta: "Remover vínculo",
  errorLastAdmin: "É necessário pelo menos um administrador da organização. Promova outro membro a administrador antes de continuar.",
  errorDuplicate: "Este utilizador já é membro desta organização.",
  errorGeneric: "Não foi possível concluir a operação. Tente novamente.",
  searching: "A procurar…",
} as const;

const MEMBERS_SERVER_SEARCH_ENABLED =
  process.env.NEXT_PUBLIC_MEMBERS_SERVER_SEARCH_ENABLED === "1" ||
  process.env.NEXT_PUBLIC_MEMBERS_SERVER_SEARCH_ENABLED === "true";

function mapApiCodeToMessage(code: string | undefined): string | undefined {
  if (code === "LAST_ORG_ADMIN") return mem.errorLastAdmin;
  if (code === "MEMBERSHIP_DUPLICATE") return mem.errorDuplicate;
  if (code === "USER_EMAIL_CONFLICT") return "Já existe uma conta com este e-mail.";
  return undefined;
}

type Issue = { kind: FeApiFailureKind; message: string } | null;

export function OrganizationMembersPage({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const mainTitleId = useId();
  const [orgName, setOrgName] = useState<string>("—");
  const [catalog, setCatalog] = useState<OrganizationDirectoryUserItem[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [qInput, setQInput] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [serverItems, setServerItems] = useState<OrganizationDirectoryUserItem[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [queryLoading, setQueryLoading] = useState(false);
  const [catalogNonce, setCatalogNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<Issue>(null);
  const [catalogRefetchIssue, setCatalogRefetchIssue] = useState<Issue>(null);
  const [catalogRefetching, setCatalogRefetching] = useState(false);
  const [catalogTruncated, setCatalogTruncated] = useState(false);
  const [liveResultCount, setLiveResultCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addPrefillEmail, setAddPrefillEmail] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<OrganizationMemberListItem | null>(null);
  const [removeRow, setRemoveRow] = useState<OrganizationMemberListItem | null>(null);
  const serverHadFirstSuccess = useRef(false);

  const loadOrgName = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/organizations/accessible?page=1&pageSize=200", {
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as { items?: { id: string; name: string }[] } | null;
      if (!res.ok) return;
      const found = body?.items?.find((o) => o.id === organizationId);
      if (found) {
        setOrgName(found.name);
      }
    } catch {
      /* ignore */
    }
  }, [organizationId]);

  const loadSystemUserCatalog = useCallback(
    async (reason: "initial" | "refresh" = "initial") => {
      if (MEMBERS_SERVER_SEARCH_ENABLED) {
        setCatalogNonce((n) => n + 1);
        return;
      }
      const isRefresh = reason === "refresh";
      if (isRefresh) {
        setCatalogRefetching(true);
        setCatalogRefetchIssue(null);
      } else {
        setLoading(true);
        setIssue(null);
        setCatalogTruncated(false);
      }
      try {
        const result = await fetchOrganizationSystemUserCatalog(organizationId, apiFetch);
        if (!result.ok) {
          if (result.code === "401") {
            router.replace(
              `/login?next=${encodeURIComponent(`/admin/organizacoes/${organizationId}/membros`)}`,
            );
            return;
          }
          let kind: FeApiFailureKind;
          let msg: string;
          if (result.code === "http") {
            const body = result.body as { code?: string; error?: string };
            const mapped = mapApiCodeToMessage(body.code);
            const parsed = messageForFailedResponse(result.status, body);
            kind = parsed.kind;
            msg = mapped ?? parsed.text;
          } else {
            kind = result.code === "network" ? "network" : "5xx";
            msg = result.code === "network" ? FE_API_COPY.network : FE_API_COPY.service5xx;
          }
          if (isRefresh) {
            setCatalogRefetchIssue({ kind, message: msg });
          } else {
            setIssue({ kind, message: msg });
            setCatalog([]);
          }
          return;
        }
        setCatalog(result.items);
        setCatalogTruncated(result.truncated);
        setCatalogRefetchIssue(null);
      } finally {
        if (isRefresh) {
          setCatalogRefetching(false);
        } else {
          setLoading(false);
        }
      }
    },
    [organizationId, router],
  );

  useEffect(() => {
    const id = window.setTimeout(() => setQDebounced(qInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [qInput]);

  useEffect(() => {
    void loadOrgName();
  }, [loadOrgName]);

  useEffect(() => {
    serverHadFirstSuccess.current = false;
    setServerItems([]);
    setServerTotal(0);
    setIssue(null);
  }, [organizationId]);

  useEffect(() => {
    if (MEMBERS_SERVER_SEARCH_ENABLED) {
      return;
    }
    void loadSystemUserCatalog("initial");
  }, [loadSystemUserCatalog]);

  useEffect(() => {
    if (!MEMBERS_SERVER_SEARCH_ENABLED) {
      return;
    }
    const ac = new AbortController();
    if (!serverHadFirstSuccess.current) {
      setLoading(true);
    }
    setQueryLoading(true);
    setIssue(null);
    void (async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (qDebounced.length > 0) {
          params.set("q", qDebounced);
        }
        const res = await apiFetch(`/api/v1/organizations/${organizationId}/system-users?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
          signal: ac.signal,
        });
        if (res.status === 401) {
          router.replace(
            `/login?next=${encodeURIComponent(`/admin/organizacoes/${organizationId}/membros`)}`,
          );
          return;
        }
        const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
        if (!res.ok) {
          let kind: FeApiFailureKind;
          let msg: string;
          const mapped = mapApiCodeToMessage((body as { code?: string })?.code);
          const parsed = messageForFailedResponse(res.status, body);
          kind = parsed.kind;
          msg = mapped ?? parsed.text;
          setIssue({ kind, message: msg });
          setServerItems([]);
          setServerTotal(0);
          return;
        }
        const data = body as {
          items: OrganizationDirectoryUserItem[];
          total: number;
          page: number;
          pageSize: number;
        };
        setServerItems(data.items ?? []);
        setServerTotal(Number(data.total ?? 0));
        setCatalogTruncated(false);
        setIssue(null);
        serverHadFirstSuccess.current = true;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          return;
        }
        setIssue({ kind: "network", message: FE_API_COPY.network });
      } finally {
        setQueryLoading(false);
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [
    MEMBERS_SERVER_SEARCH_ENABLED,
    organizationId,
    page,
    pageSize,
    qDebounced,
    catalogNonce,
    router,
  ]);

  const clientFilteredCatalog = useMemo(() => {
    const needle = qInput.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter((row) => {
      const name = row.displayName.toLowerCase();
      return row.email.toLowerCase().includes(needle) || name.includes(needle);
    });
  }, [catalog, qInput]);

  useEffect(() => {
    setPage(1);
  }, [qInput]);

  const totalFiltered = MEMBERS_SERVER_SEARCH_ENABLED ? serverTotal : clientFilteredCatalog.length;
  const pageSlice = useMemo(() => {
    if (MEMBERS_SERVER_SEARCH_ENABLED) {
      return serverItems;
    }
    const start = (page - 1) * pageSize;
    return clientFilteredCatalog.slice(start, start + pageSize);
  }, [MEMBERS_SERVER_SEARCH_ENABLED, serverItems, clientFilteredCatalog, page, pageSize]);

  useEffect(() => {
    const id = window.setTimeout(() => setLiveResultCount(totalFiltered), 350);
    return () => window.clearTimeout(id);
  }, [qInput, totalFiltered]);

  useEffect(() => {
    if (issue?.kind === "401") {
      router.replace(
        `/login?next=${encodeURIComponent(`/admin/organizacoes/${organizationId}/membros`)}`,
      );
    }
  }, [issue?.kind, organizationId, router]);

  const showInitialSkeleton =
    loading &&
    !issue &&
    (MEMBERS_SERVER_SEARCH_ENABLED ? !serverHadFirstSuccess.current : catalog.length === 0);

  if (showInitialSkeleton) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-48 animate-pulse rounded-xl border border-black/5 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06]" />
      </div>
    );
  }

  const showBlockingError =
    issue &&
    issue.kind !== "401" &&
    (MEMBERS_SERVER_SEARCH_ENABLED ? serverItems.length === 0 : catalog.length === 0);

  if (showBlockingError) {
    return (
      <div
        className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-800 dark:text-red-100"
        role="alert"
        aria-live="polite"
      >
        <p>{issue.message}</p>
        <p className="mt-4">
          <Link href="/admin/organizacoes" className="font-medium text-emerald-800 underline dark:text-emerald-300">
            {mem.backToOrganizations}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="text-xs text-black/55 dark:text-white/50" aria-label="Navegação de contexto">
        <Link href="/admin/organizacoes" className="text-emerald-800 underline dark:text-emerald-300">
          Organizações
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-black/70 dark:text-white/65">{mem.listTitle}</span>
      </nav>

      <header>
        <h1 id={mainTitleId} className="text-2xl font-semibold tracking-tight">
          {mem.listTitle}
        </h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">{mem.listSubtitle(orgName)}</p>
      </header>

      {catalogTruncated ? (
        <p
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          {mem.truncationWarning(10000)}
        </p>
      ) : null}

      {catalogRefetchIssue ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-3 text-sm text-red-900 dark:text-red-100 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
          aria-live="polite"
        >
          <p>{catalogRefetchIssue.message}</p>
          <button
            type="button"
            onClick={() => void loadSystemUserCatalog("refresh")}
            disabled={catalogRefetching}
            className="shrink-0 rounded-lg border border-red-800/30 px-3 py-1.5 font-medium text-red-950 underline-offset-2 hover:underline disabled:opacity-50 dark:border-red-200/30 dark:text-red-50"
          >
            {mem.catalogRefetchRetry}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="max-w-md flex-1 space-y-1">
          <label htmlFor="q-members" className="text-xs font-medium text-black/70 dark:text-white/65">
            {mem.searchLabel}
          </label>
          <input
            id="q-members"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={mem.searchPlaceholder}
            className="w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
            autoComplete="off"
          />
          {MEMBERS_SERVER_SEARCH_ENABLED && queryLoading ? (
            <p className="text-xs text-black/50 dark:text-white/45" aria-live="polite">
              {mem.searching}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAddPrefillEmail(undefined);
              setAddOpen(true);
            }}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium dark:border-white/15"
          >
            {mem.ctaAddExisting}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--background)]"
          >
            {mem.ctaCreateUser}
          </button>
        </div>
      </div>

      {qInput.trim() && liveResultCount !== null ? (
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {mem.liveRegionResults(liveResultCount)}
        </p>
      ) : null}

      <div
        className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10"
        aria-busy={busy || catalogRefetching}
      >
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs font-medium text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/55">
            <tr>
              <th className="px-3 py-2">{mem.tableUser}</th>
              <th className="px-3 py-2">{mem.tableSuperadmin}</th>
              <th className="px-3 py-2">{mem.tableInOrg}</th>
              <th className="px-3 py-2">{mem.tableRole}</th>
              <th className="px-3 py-2">{mem.tableJob}</th>
              <th className="px-3 py-2">{mem.tableDept}</th>
              <th className="px-3 py-2">{mem.tablePhone}</th>
              <th className="px-3 py-2">{mem.tableActions}</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-black/55 dark:text-white/50">
                  {qInput.trim() ? mem.emptyFilter : mem.emptySystem}
                </td>
              </tr>
            ) : (
              pageSlice.map((row) => {
                const m = row.member;
                return (
                  <tr key={row.userId} className="border-b border-black/5 last:border-0 dark:border-white/10">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.displayName || "—"}</div>
                      <div className="text-xs text-black/50 dark:text-white/45">{row.email}</div>
                    </td>
                    <td className="px-3 py-2 text-black/80 dark:text-white/75">
                      {row.isSuperadmin ? mem.superadminYes : mem.superadminNo}
                    </td>
                    <td className="px-3 py-2 text-black/80 dark:text-white/75">{m ? mem.inOrgYes : mem.inOrgNo}</td>
                    <td className="px-3 py-2">
                      {m ? (m.orgRole === "admin" ? mem.roleAdmin : mem.roleUser) : "—"}
                    </td>
                    <td className="px-3 py-2 text-black/80 dark:text-white/75">{m?.jobTitle ?? "—"}</td>
                    <td className="px-3 py-2 text-black/80 dark:text-white/75">{m?.department ?? "—"}</td>
                    <td className="px-3 py-2 text-black/80 dark:text-white/75">{m?.phone ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {m ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditRow(m)}
                              className="text-xs font-medium text-emerald-800 underline dark:text-emerald-300"
                              aria-label={`${mem.rowEdit} · ${m.email}`}
                            >
                              {mem.rowEdit}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemoveRow(m)}
                              className="text-xs font-medium text-red-700 underline dark:text-red-300"
                              aria-label={`${mem.rowRemove} · ${m.email}`}
                            >
                              {mem.rowRemove}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAddPrefillEmail(row.email);
                              setAddOpen(true);
                            }}
                            className="text-xs font-medium text-emerald-800 underline dark:text-emerald-300"
                            aria-label={`${mem.rowAddToOrg} · ${row.email}`}
                          >
                            {mem.rowAddToOrg}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalFiltered > pageSize ? (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1 || busy}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/15"
          >
            Anterior
          </button>
          <span className="text-black/60 dark:text-white/55">{mem.paginationStatus(page, totalFiltered)}</span>
          <button
            type="button"
            disabled={page * pageSize >= totalFiltered || busy}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/15"
          >
            Seguinte
          </button>
        </div>
      ) : null}

      <AddExistingModal
        open={addOpen}
        initialEmail={addPrefillEmail}
        onClose={() => {
          setAddOpen(false);
          setAddPrefillEmail(undefined);
        }}
        organizationId={organizationId}
        onDone={() => {
          setAddOpen(false);
          setAddPrefillEmail(undefined);
          void loadSystemUserCatalog("refresh");
        }}
        setBusy={setBusy}
      />
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
        onDone={() => {
          setCreateOpen(false);
          void loadSystemUserCatalog("refresh");
        }}
        setBusy={setBusy}
      />
      <EditMemberModal
        open={Boolean(editRow)}
        row={editRow}
        onClose={() => setEditRow(null)}
        organizationId={organizationId}
        onDone={() => {
          setEditRow(null);
          void loadSystemUserCatalog("refresh");
        }}
        setBusy={setBusy}
      />
      <RemoveMemberModal
        open={Boolean(removeRow)}
        row={removeRow}
        onClose={() => setRemoveRow(null)}
        organizationId={organizationId}
        onDone={() => {
          setRemoveRow(null);
          void loadSystemUserCatalog("refresh");
        }}
        setBusy={setBusy}
      />
    </div>
  );
}

function AddExistingModal(props: {
  open: boolean;
  initialEmail?: string;
  onClose: () => void;
  organizationId: string;
  onDone: () => void;
  setBusy: (v: boolean) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState("");
  const [orgRole, setOrgRole] = useState<"user" | "admin">("user");
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) {
      setEmail("");
      setOrgRole("user");
      setAlert(null);
      return;
    }
    setEmail(props.initialEmail?.trim() ?? "");
    setOrgRole("user");
    setAlert(null);
    const t = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [props.open, props.initialEmail]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props]);

  if (!props.open) return null;

  async function submit() {
    setAlert(null);
    props.setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/organizations/${props.organizationId}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "link", email: email.trim(), orgRole }),
      });
      const body = (await res.json().catch(() => null)) as { code?: string; error?: string };
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        setAlert(mapApiCodeToMessage(body.code) ?? messageForFailedResponse(res.status, body).text ?? mem.errorGeneric);
        return;
      }
      props.onDone();
    } catch {
      setAlert(mem.errorGeneric);
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={props.onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-xl border border-black/10 bg-[var(--background)] p-6 shadow-lg dark:border-white/15"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {mem.addExistingTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-2 py-1 text-sm text-black/55 hover:bg-black/[0.06] dark:text-white/50"
          >
            Fechar
          </button>
        </div>
        {alert ? (
          <p className="mb-3 text-sm text-red-700 dark:text-red-200" role="alert">
            {alert}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-black/70 dark:text-white/65">E-mail</label>
        <input
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
        />
        <label className="mt-3 block text-xs font-medium text-black/70 dark:text-white/65">Papel</label>
        <select
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value as "user" | "admin")}
        >
          <option value="user">{mem.roleUser}</option>
          <option value="admin">{mem.roleAdmin}</option>
        </select>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--background)]"
          >
            {mem.addExistingSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal(props: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  onDone: () => void;
  setBusy: (v: boolean) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgRole, setOrgRole] = useState<"user" | "admin">("user");
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) {
      setName("");
      setEmail("");
      setPassword("");
      setOrgRole("user");
      setAlert(null);
      return;
    }
    const t = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props]);

  if (!props.open) return null;

  async function submit() {
    setAlert(null);
    props.setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/organizations/${props.organizationId}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          name: name.trim(),
          email: email.trim(),
          password,
          orgRole,
        }),
      });
      const body = (await res.json().catch(() => null)) as { code?: string; error?: string };
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        setAlert(mapApiCodeToMessage(body.code) ?? messageForFailedResponse(res.status, body).text ?? mem.errorGeneric);
        return;
      }
      props.onDone();
    } catch {
      setAlert(mem.errorGeneric);
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={props.onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-xl border border-black/10 bg-[var(--background)] p-6 shadow-lg dark:border-white/15"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {mem.createUserTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-2 py-1 text-sm text-black/55 hover:bg-black/[0.06] dark:text-white/50"
          >
            Fechar
          </button>
        </div>
        {alert ? (
          <p className="mb-3 text-sm text-red-700 dark:text-red-200" role="alert">
            {alert}
          </p>
        ) : null}
        <label className="block text-xs font-medium">Nome</label>
        <input
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="mt-3 block text-xs font-medium">E-mail</label>
        <input
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        <label className="mt-3 block text-xs font-medium">Palavra-passe (mín. 8)</label>
        <input
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="new-password"
        />
        <label className="mt-3 block text-xs font-medium">Papel</label>
        <select
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value as "user" | "admin")}
        >
          <option value="user">{mem.roleUser}</option>
          <option value="admin">{mem.roleAdmin}</option>
        </select>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--background)]"
          >
            {mem.createUserSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditMemberModal(props: {
  open: boolean;
  row: OrganizationMemberListItem | null;
  onClose: () => void;
  organizationId: string;
  onDone: () => void;
  setBusy: (v: boolean) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [orgRole, setOrgRole] = useState<"user" | "admin">("user");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open || !props.row) return;
    setOrgRole(props.row.orgRole);
    setJobTitle(props.row.jobTitle ?? "");
    setDepartment(props.row.department ?? "");
    setPhone(props.row.phone ?? "");
    setAlert(null);
    const t = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [props.open, props.row]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props]);

  if (!props.open || !props.row) return null;
  const row = props.row;

  async function submit() {
    setAlert(null);
    props.setBusy(true);
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${props.organizationId}/members/${row.membershipId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgRole,
            jobTitle: jobTitle.trim() || null,
            department: department.trim() || null,
            phone: phone.trim() || null,
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as { code?: string; error?: string };
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        setAlert(mapApiCodeToMessage(body.code) ?? messageForFailedResponse(res.status, body).text ?? mem.errorGeneric);
        return;
      }
      props.onDone();
    } catch {
      setAlert(mem.errorGeneric);
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={props.onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-xl border border-black/10 bg-[var(--background)] p-6 shadow-lg dark:border-white/15"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {mem.editTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-2 py-1 text-sm text-black/55 hover:bg-black/[0.06] dark:text-white/50"
          >
            Fechar
          </button>
        </div>
        {alert ? (
          <p className="mb-3 text-sm text-red-700 dark:text-red-200" role="alert">
            {alert}
          </p>
        ) : null}
        <p className="text-xs text-black/55 dark:text-white/50">{row.email}</p>
        <label className="mt-3 block text-xs font-medium">Papel</label>
        <select
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value as "user" | "admin")}
        >
          <option value="user">{mem.roleUser}</option>
          <option value="admin">{mem.roleAdmin}</option>
        </select>
        <label className="mt-3 block text-xs font-medium">{mem.tableJob}</label>
        <input
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
        <label className="mt-3 block text-xs font-medium">{mem.tableDept}</label>
        <input
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <label className="mt-3 block text-xs font-medium">{mem.tablePhone}</label>
        <input
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--background)]"
          >
            {mem.editSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveMemberModal(props: {
  open: boolean;
  row: OrganizationMemberListItem | null;
  onClose: () => void;
  organizationId: string;
  onDone: () => void;
  setBusy: (v: boolean) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) {
      setAlert(null);
      return;
    }
    const t = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props]);

  if (!props.open || !props.row) return null;
  const row = props.row;

  async function submit() {
    setAlert(null);
    props.setBusy(true);
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${props.organizationId}/members/${row.membershipId}`,
        { method: "DELETE", credentials: "include" },
      );
      const body = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok && res.status !== 204) {
        setAlert(
          mapApiCodeToMessage(body?.code) ?? messageForFailedResponse(res.status, body).text ?? mem.errorGeneric,
        );
        return;
      }
      props.onDone();
    } catch {
      setAlert(mem.errorGeneric);
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={props.onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-xl border border-black/10 bg-[var(--background)] p-6 shadow-lg dark:border-white/15"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {mem.removeTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-2 py-1 text-sm text-black/55 hover:bg-black/[0.06] dark:text-white/50"
          >
            Fechar
          </button>
        </div>
        {alert ? (
          <p className="mb-3 text-sm text-red-700 dark:text-red-200" role="alert">
            {alert}
          </p>
        ) : null}
        <p className="text-sm text-black/75 dark:text-white/70">{mem.removeBody}</p>
        <p className="mt-2 text-xs text-black/55 dark:text-white/50">{row.email}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
          >
            {mem.removeCta}
          </button>
        </div>
      </div>
    </div>
  );
}


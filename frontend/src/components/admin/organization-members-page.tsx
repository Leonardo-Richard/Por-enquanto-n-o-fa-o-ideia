"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  classifyThrownFetchError,
  FE_API_COPY,
  messageForFailedResponse,
  type FeApiFailureKind,
} from "@/lib/fe-api-error";
import type { OrganizationMemberListItem } from "@repo/shared";

/** Copy PT-BR (spec UX §10 / mem.*). `mem.error.duplicate` — spec corrigida; não usar `mem.mem.*`. */
const mem = {
  backToOrganizations: "Voltar às organizações",
  listTitle: "Membros",
  listSubtitle: (name: string) => `Organização: ${name}`,
  searchLabel: "Buscar por nome ou e-mail",
  searchPlaceholder: "Buscar membros…",
  empty: "Ainda não há membros nesta organização.",
  emptySearch: "Nenhum membro corresponde à pesquisa.",
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
} as const;

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
  const [items, setItems] = useState<OrganizationMemberListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [qInput, setQInput] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<Issue>(null);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<OrganizationMemberListItem | null>(null);
  const [removeRow, setRemoveRow] = useState<OrganizationMemberListItem | null>(null);

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

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setIssue(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (qApplied.trim()) {
      params.set("q", qApplied.trim());
    }
    try {
      const res = await apiFetch(
        `/api/v1/organizations/${organizationId}/members?${params.toString()}`,
        { credentials: "include" },
      );
      const body = (await res.json().catch(() => null)) as unknown;
      if (res.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/admin/organizacoes/${organizationId}/membros`)}`,
        );
        return;
      }
      if (!res.ok) {
        const parsed = body as { code?: string; error?: string };
        const mapped = mapApiCodeToMessage(parsed.code);
        const { kind, text } = messageForFailedResponse(res.status, body);
        setIssue({ kind, message: mapped ?? text });
        setItems([]);
        setTotal(0);
        return;
      }
      const data = body as { items: OrganizationMemberListItem[]; total: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      const net = classifyThrownFetchError(e);
      if (net === "network") {
        setIssue({ kind: "network", message: FE_API_COPY.network });
      } else {
        setIssue({ kind: "5xx", message: FE_API_COPY.service5xx });
      }
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [organizationId, page, pageSize, qApplied, router]);

  useEffect(() => {
    void loadOrgName();
  }, [loadOrgName]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const combinedIssue = issue;

  useEffect(() => {
    if (combinedIssue?.kind === "401") {
      router.replace(
        `/login?next=${encodeURIComponent(`/admin/organizacoes/${organizationId}/membros`)}`,
      );
    }
  }, [combinedIssue?.kind, organizationId, router]);

  function applySearch() {
    setPage(1);
    setQApplied(qInput);
  }

  if (loading && items.length === 0 && !combinedIssue) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-48 animate-pulse rounded-xl border border-black/5 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06]" />
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="max-w-md flex-1 space-y-1">
          <label htmlFor="q-members" className="text-xs font-medium text-black/70 dark:text-white/65">
            {mem.searchLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="q-members"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={mem.searchPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
            />
            <button
              type="button"
              onClick={() => applySearch()}
              className="shrink-0 rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--background)]"
            >
              Buscar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
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

      <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10" aria-busy={busy}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs font-medium text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/55">
            <tr>
              <th className="px-3 py-2">{mem.tableUser}</th>
              <th className="px-3 py-2">{mem.tableRole}</th>
              <th className="px-3 py-2">{mem.tableJob}</th>
              <th className="px-3 py-2">{mem.tableDept}</th>
              <th className="px-3 py-2">{mem.tablePhone}</th>
              <th className="px-3 py-2">{mem.tableActions}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-black/55 dark:text-white/50">
                  {qApplied.trim() ? mem.emptySearch : mem.empty}
                </td>
              </tr>
            ) : (
              items.map((m) => (
                <tr key={m.membershipId} className="border-b border-black/5 last:border-0 dark:border-white/10">
                  <td className="px-3 py-2">
                    <div className="font-medium">{m.displayName ?? "—"}</div>
                    <div className="text-xs text-black/50 dark:text-white/45">{m.email}</div>
                  </td>
                  <td className="px-3 py-2">{m.orgRole === "admin" ? mem.roleAdmin : mem.roleUser}</td>
                  <td className="px-3 py-2 text-black/80 dark:text-white/75">{m.jobTitle ?? "—"}</td>
                  <td className="px-3 py-2 text-black/80 dark:text-white/75">{m.department ?? "—"}</td>
                  <td className="px-3 py-2 text-black/80 dark:text-white/75">{m.phone ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditRow(m)}
                        className="text-xs font-medium text-emerald-800 underline dark:text-emerald-300"
                      >
                        {mem.rowEdit}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveRow(m)}
                        className="text-xs font-medium text-red-700 underline dark:text-red-300"
                      >
                        {mem.rowRemove}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize ? (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1 || busy}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/15"
          >
            Anterior
          </button>
          <span className="text-black/60 dark:text-white/55">
            Página {page} · {total} membro(s)
          </span>
          <button
            type="button"
            disabled={page * pageSize >= total || busy}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/15"
          >
            Seguinte
          </button>
        </div>
      ) : null}

      <AddExistingModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        organizationId={organizationId}
        onDone={() => {
          setAddOpen(false);
          void loadMembers();
        }}
        setBusy={setBusy}
      />
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
        onDone={() => {
          setCreateOpen(false);
          void loadMembers();
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
          void loadMembers();
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
          void loadMembers();
        }}
        setBusy={setBusy}
      />
    </div>
  );
}

function AddExistingModal(props: {
  open: boolean;
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


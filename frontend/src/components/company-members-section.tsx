"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { TableLoadingSkeleton } from "@/components/page-loading-skeleton";
import { apiFetch } from "@/lib/api-client";

type MemberRow = {
  userId: string;
  email: string;
  name: string;
  companyRole: "user" | "admin";
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
};

export function CompanyMembersSection({ companyId }: { companyId: string }) {
  const searchId = useId();

  const [items, setItems] = useState<MemberRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [mode, setMode] = useState<"link" | "create">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [formError, setFormError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setForbidden(false);
    const qs = new URLSearchParams({ page: "1", pageSize: "100" });
    if (q.trim()) {
      qs.set("q", q.trim());
    }
    const res = await apiFetch(`/api/v1/companies/${companyId}/members?${qs}`);
    if (res.status === 403) {
      setForbidden(true);
      setItems([]);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Não foi possível carregar membros desta empresa.");
      setItems([]);
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { items: MemberRow[] };
    setItems(body.items);
    setLoading(false);
  }

  useEffect(() => {
    if (!companyId) {
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarregar ao mudar empresa
  }, [companyId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const body =
      mode === "link"
        ? { mode: "link" as const, email: email.trim(), companyRole: role }
        : {
            mode: "create" as const,
            email: email.trim(),
            password,
            name: name.trim(),
            companyRole: role,
          };
    const res = await apiFetch(`/api/v1/companies/${companyId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setFormError(j?.error?.message ?? "Erro ao adicionar.");
      return;
    }
    setEmail("");
    setPassword("");
    setName("");
    await load();
  }

  async function patchRole(userId: string, companyRole: "user" | "admin") {
    const res = await apiFetch(`/api/v1/companies/${companyId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyRole }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setFormError(j?.error?.message ?? "Erro ao atualizar papel.");
      return;
    }
    await load();
  }

  async function confirmRemove() {
    if (!removeTarget) {
      return;
    }
    const res = await apiFetch(`/api/v1/companies/${companyId}/members/${removeTarget.userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setFormError(j?.error?.message ?? "Erro ao remover.");
      return;
    }
    setRemoveTarget(null);
    await load();
  }

  if (forbidden) {
    return (
      <p className="text-sm text-black/65 dark:text-white/60">
        Não tem permissão para gerir membros desta empresa monitorada.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-black/65 dark:text-white/60">
        Membros com acesso <strong className="font-medium">só a esta empresa monitorada</strong> (nível
        fiscal). Diferente dos membros da organização, que veem todas as empresas da org.
      </p>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {formError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {formError}
        </p>
      ) : null}

      <section className="rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="text-sm font-semibold">Adicionar à empresa</h2>
        <form className="mt-4 space-y-3" onSubmit={(ev) => void onAdd(ev)}>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="company-member-mode"
                checked={mode === "link"}
                onChange={() => setMode("link")}
              />
              Vincular existente
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="company-member-mode"
                checked={mode === "create"}
                onChange={() => setMode("create")}
              />
              Criar e vincular
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-black/70 dark:text-white/65">E-mail</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm dark:border-white/15"
              />
            </div>
            {mode === "create" ? (
              <div>
                <label className="text-xs font-medium text-black/70 dark:text-white/65">Nome</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm dark:border-white/15"
                />
              </div>
            ) : null}
            {mode === "create" ? (
              <div>
                <label className="text-xs font-medium text-black/70 dark:text-white/65">Senha inicial</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm dark:border-white/15"
                />
              </div>
            ) : null}
            <div>
              <label className="text-xs font-medium text-black/70 dark:text-white/65">Papel na empresa</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "user" | "admin")}
                className="mt-1 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm dark:border-white/15"
              >
                <option value="user">Utilizador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
          >
            Adicionar
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label htmlFor={searchId} className="text-xs font-medium text-black/70 dark:text-white/65">
              Pesquisar
            </label>
            <input
              id={searchId}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="h-10 rounded-lg border border-black/15 px-4 text-sm dark:border-white/20"
          >
            Aplicar
          </button>
        </div>

        {loading ? (
          <TableLoadingSkeleton rows={4} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-black/5 bg-black/[0.03] text-xs font-medium uppercase tracking-wide text-black/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Papel</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-black/55 dark:text-white/50">
                      Nenhum membro ao nível desta empresa.
                    </td>
                  </tr>
                ) : (
                  items.map((m) => (
                    <tr key={m.userId}>
                      <td className="px-3 py-2">{m.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{m.email}</td>
                      <td className="px-3 py-2">{m.companyRole === "admin" ? "Admin" : "Utilizador"}</td>
                      <td className="space-x-2 px-3 py-2">
                        {m.companyRole === "admin" ? (
                          <button
                            type="button"
                            className="text-xs text-black/70 underline dark:text-white/65"
                            onClick={() => void patchRole(m.userId, "user")}
                          >
                            Rebaixar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-black/70 underline dark:text-white/65"
                            onClick={() => void patchRole(m.userId, "admin")}
                          >
                            Promover
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs text-red-600 underline dark:text-red-400"
                          onClick={() => setRemoveTarget(m)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {removeTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-remove-title"
        >
          <div className="max-w-md rounded-xl bg-[var(--background)] p-6 text-sm shadow-lg">
            <h2 id="company-remove-title" className="text-base font-semibold">
              Remover da empresa
            </h2>
            <p className="mt-3 text-black/75 dark:text-white/70">
              O utilizador deixa de aceder a esta empresa monitorada. A conta global e o vínculo com a
              organização podem permanecer.
            </p>
            <p className="mt-2 font-mono text-xs">{removeTarget.email}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/20"
                onClick={() => setRemoveTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => void confirmRemove()}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useId, useState } from "react";

export type CreateOrganizationResult =
  | {
      ok: true;
      body: {
        id: string;
        name: string;
        tradeName: string | null;
        taxIdMasked: string | null;
        createdAt: string;
        localAdminLinked: boolean;
      };
    }
  | { ok: false; status: number; message: string };

type Props = {
  onSubmitted: (result: CreateOrganizationResult) => void;
  onCancel: () => void;
};

export function CreateOrganizationForm({ onSubmitted, onCancel }: Props) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const tradeId = `${baseId}-trade`;
  const taxId = `${baseId}-tax`;
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [taxIdDigits, setTaxIdDigits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        tradeName: tradeName.trim() === "" ? null : tradeName.trim(),
        taxIdDigits: taxIdDigits.trim() === "" ? null : taxIdDigits.trim(),
      };
      const res = await fetch("/api/v1/organizations", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-organization-create-source": "admin_ui",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      const message = typeof json?.message === "string" ? json.message : "Pedido falhou.";
      if (!res.ok) {
        onSubmitted({ ok: false, status: res.status, message });
        if (res.status === 409 || res.status === 400) {
          setFieldError(message);
        }
        return;
      }
      if (json && typeof json === "object" && "id" in json && "localAdminLinked" in json) {
        const o = json as {
          id: string;
          name: string;
          tradeName: string | null;
          taxIdMasked: string | null;
          createdAt: string;
          localAdminLinked: boolean;
        };
        onSubmitted({
          ok: true,
          body: {
            id: o.id,
            name: o.name,
            tradeName: o.tradeName ?? null,
            taxIdMasked: o.taxIdMasked ?? null,
            createdAt: o.createdAt,
            localAdminLinked: Boolean(o.localAdminLinked),
          },
        });
      } else {
        onSubmitted({ ok: false, status: res.status, message: "Resposta inválida do servidor." });
      }
    } catch {
      onSubmitted({ ok: false, status: 0, message: "Erro de rede. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      {fieldError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-100" role="alert">
          {fieldError}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="text-xs font-medium text-black/70 dark:text-white/65">
          Nome da organização
        </label>
        <input
          id={nameId}
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="organization"
          className="w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          placeholder="Ex.: ACME Lda."
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={tradeId} className="text-xs font-medium text-black/70 dark:text-white/65">
          Nome fantasia (opcional)
        </label>
        <input
          id={tradeId}
          name="tradeName"
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          className="w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={taxId} className="text-xs font-medium text-black/70 dark:text-white/65">
          CNPJ (opcional, 14 dígitos)
        </label>
        <input
          id={taxId}
          name="taxIdDigits"
          inputMode="numeric"
          value={taxIdDigits}
          onChange={(e) => setTaxIdDigits(e.target.value.replace(/\D/g, "").slice(0, 14))}
          className="w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          placeholder="Somente números"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-black/15 px-4 text-sm font-medium dark:border-white/20"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        >
          {submitting ? "A criar…" : "Criar organização"}
        </button>
      </div>
    </form>
  );
}

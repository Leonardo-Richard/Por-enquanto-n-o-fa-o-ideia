"use client";

import { useEffect, useId, useRef } from "react";
import {
  CreateOrganizationForm,
  type CreateOrganizationResult,
} from "@/components/admin/create-organization-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: Extract<CreateOrganizationResult, { ok: true }>["body"]) => void;
};

export function CreateOrganizationDialog({ open, onOpenChange, onCreated }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => closeRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-xl border border-black/10 bg-[var(--background)] p-6 shadow-lg dark:border-white/15"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            Nova organização
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-2 py-1 text-sm text-black/55 hover:bg-black/[0.06] dark:text-white/50 dark:hover:bg-white/[0.08]"
          >
            Fechar
          </button>
        </div>
        <CreateOrganizationForm
          onCancel={() => onOpenChange(false)}
          onSubmitted={(result) => {
            if (result.ok) {
              onCreated(result.body);
              onOpenChange(false);
              return;
            }
            if (result.status === 401) {
              window.location.href = `/login?next=${encodeURIComponent("/admin/organizacoes")}`;
            }
          }}
        />
      </div>
    </div>
  );
}

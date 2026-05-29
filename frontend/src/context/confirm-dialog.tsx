"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmState | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      pending?.resolve(result);
      setPending(null);
      dialogRef.current?.close();
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) {
      return;
    }
    const dlg = dialogRef.current;
    if (!dlg) {
      return;
    }
    dlg.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      close(false);
    };
    dlg.addEventListener("cancel", onCancel);
    return () => dlg.removeEventListener("cancel", onCancel);
  }, [pending, close]);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending ? (
        <dialog
          ref={dialogRef}
          className="max-w-md rounded-xl border border-black/10 bg-[var(--background)] p-6 text-sm shadow-xl backdrop:bg-black/40 dark:border-white/15"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onClose={() => close(false)}
        >
          <h2 id={titleId} className="text-base font-semibold text-black/90 dark:text-white/90">
            {pending.title}
          </h2>
          <p id={descId} className="mt-3 leading-relaxed text-black/75 dark:text-white/70">
            {pending.description}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
              onClick={() => close(false)}
            >
              {pending.cancelLabel ?? "Cancelar"}
            </button>
            <button
              type="button"
              autoFocus
              className={
                pending.tone === "danger"
                  ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
              }
              onClick={() => close(true)}
            >
              {pending.confirmLabel ?? "Confirmar"}
            </button>
          </div>
        </dialog>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return ctx;
}

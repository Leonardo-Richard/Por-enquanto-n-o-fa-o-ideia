"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "info" | "success" | "error";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ShowToastArgs = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type UiToastContextValue = {
  showToast: (args: ShowToastArgs) => void;
};

const UiToastContext = createContext<UiToastContextValue | null>(null);

function toneClasses(tone: ToastTone): string {
  if (tone === "success") {
    return "border-emerald-300/50 bg-emerald-50/95 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-900/40 dark:text-emerald-100";
  }
  if (tone === "error") {
    return "border-red-300/55 bg-red-50/95 text-red-950 dark:border-red-400/35 dark:bg-red-900/35 dark:text-red-100";
  }
  return "border-black/15 bg-white/95 text-black/90 dark:border-white/15 dark:bg-zinc-900/95 dark:text-white/90";
}

export function UiToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, description, tone = "info", durationMs = 4200 }: ShowToastArgs) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, title, description, tone }]);
      window.setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast],
  );

  const value = useMemo<UiToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <UiToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-lg backdrop-blur ${toneClasses(toast.tone)}`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="mt-0.5 text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </UiToastContext.Provider>
  );
}

export function useUiToast() {
  const ctx = useContext(UiToastContext);
  if (!ctx) {
    throw new Error("useUiToast deve ser usado dentro de UiToastProvider.");
  }
  return ctx;
}

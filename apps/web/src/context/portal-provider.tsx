"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Company, Execution, PortalSettings } from "@repo/shared";

const STORAGE_KEY = "portal-automacao-nf.data.v1";

type Persisted = {
  executions: Execution[];
  settings: PortalSettings;
};

const defaultSettings: PortalSettings = {
  localRootPath: "C:\\NFs",
  notifyEmailOnFailure: true,
  timezone: "America/Sao_Paulo",
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return { executions: [], settings: defaultSettings };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { executions: [], settings: defaultSettings };
    }
    const parsed = JSON.parse(raw) as Persisted & { companies?: unknown };
    return {
      executions: Array.isArray(parsed.executions) ? parsed.executions : [],
      settings: { ...defaultSettings, ...parsed.settings },
    };
  } catch {
    return { executions: [], settings: defaultSettings };
  }
}

type PortalContextValue = {
  hydrated: boolean;
  executions: Execution[];
  settings: PortalSettings;
  appendExecution: (execution: Execution) => void;
  runSync: (companyId: string, trigger: Execution["trigger"], companyCnpjDigits: string) => void;
  updateSettings: (patch: Partial<PortalSettings>) => void;
  pathForCompany: (company: Pick<Company, "cnpjDigits" | "systemCode">) => string;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(defaultSettings);

  useEffect(() => {
    const data = loadPersisted();
    setExecutions(data.executions);
    setSettings(data.settings);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    const payload: Persisted = { executions, settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, executions, settings]);

  const pathForCompany = useCallback(
    (company: Pick<Company, "cnpjDigits" | "systemCode">) => {
      const root = settings.localRootPath.replace(/[/\\]+$/, "");
      const safeCode = company.systemCode.replace(/[/\\?%*:|"<>]/g, "-");
      return `${root}\\${company.cnpjDigits}\\${safeCode}`;
    },
    [settings.localRootPath],
  );

  const appendExecution = useCallback((execution: Execution) => {
    setExecutions((prev) => [execution, ...prev]);
  }, []);

  const runSync = useCallback(
    (companyId: string, trigger: Execution["trigger"], companyCnpjDigits: string) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `ex-${Date.now()}`;
      const startedAt = new Date().toISOString();
      const running: Execution = {
        id,
        companyId,
        companyCnpjDigits,
        status: "running",
        trigger,
        startedAt,
      };
      setExecutions((prev) => [running, ...prev]);

      window.setTimeout(() => {
        const finishedAt = new Date().toISOString();
        const done: Execution = {
          ...running,
          status: "success",
          finishedAt,
          detail:
            "Sincronização concluída (simulada). Verifique a pasta local com o agente instalado.",
          filesCount: Math.floor(Math.random() * 5),
        };
        setExecutions((prev) => prev.map((e) => (e.id === id ? done : e)));
      }, 900);
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<PortalSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<PortalContextValue>(
    () => ({
      hydrated,
      executions,
      settings,
      appendExecution,
      runSync,
      updateSettings,
      pathForCompany,
    }),
    [hydrated, executions, settings, appendExecution, runSync, updateSettings, pathForCompany],
  );

  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal must be used within PortalProvider");
  }
  return ctx;
}

export function buildWelcomeExecution(company: Company): Execution {
  const startedAt = new Date().toISOString();
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ex-${Date.now()}`,
    companyId: company.id,
    companyCnpjDigits: company.cnpjDigits,
    status: "success",
    trigger: "signup",
    startedAt,
    finishedAt: startedAt,
    detail: "Primeira coleta após cadastro (simulada).",
    filesCount: 0,
  };
}

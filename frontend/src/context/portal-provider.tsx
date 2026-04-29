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
import { sanitizeSystemCodeForMirrorPath } from "@/lib/mirror-destination-preview";

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
      const safeCode = sanitizeSystemCodeForMirrorPath(company.systemCode);
      return `${root}\\${safeCode} - ${company.cnpjDigits}`;
    },
    [settings.localRootPath],
  );

  const appendExecution = useCallback((execution: Execution) => {
    setExecutions((prev) => [execution, ...prev]);
  }, []);

  const updateSettings = useCallback((patch: Partial<PortalSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<PortalContextValue>(
    () => ({
      hydrated,
      executions,
      settings,
      appendExecution,
      updateSettings,
      pathForCompany,
    }),
    [hydrated, executions, settings, appendExecution, updateSettings, pathForCompany],
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

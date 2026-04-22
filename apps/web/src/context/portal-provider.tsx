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
import { hydrateMonthlyRunDay } from "@repo/shared";

const STORAGE_KEY = "portal-automacao-nf.data.v1";

type User = {
  email: string;
};

type Persisted = {
  user: User | null;
  companies: Company[];
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
    return {
      user: null,
      companies: [],
      executions: [],
      settings: defaultSettings,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        user: null,
        companies: [],
        executions: [],
        settings: defaultSettings,
      };
    }
    const parsed = JSON.parse(raw) as Persisted;
    return {
      user: parsed.user ?? null,
      companies: Array.isArray(parsed.companies)
        ? parsed.companies.map((row) => {
            const c = row as Company;
            return {
              ...c,
              monthlyRunDay: hydrateMonthlyRunDay(
                (c as { monthlyRunDay?: unknown }).monthlyRunDay,
              ),
            };
          })
        : [],
      executions: Array.isArray(parsed.executions) ? parsed.executions : [],
      settings: { ...defaultSettings, ...parsed.settings },
    };
  } catch {
    return {
      user: null,
      companies: [],
      executions: [],
      settings: defaultSettings,
    };
  }
}

type PortalContextValue = {
  hydrated: boolean;
  user: User | null;
  companies: Company[];
  executions: Execution[];
  settings: PortalSettings;
  login: (email: string, password: string) => void;
  logout: () => void;
  addCompany: (input: {
    cnpjDigits: string;
    tradeName: string;
    systemCode: string;
    monthlyRunDay?: number;
  }) => Company;
  updateCompany: (
    id: string,
    patch: Partial<Pick<Company, "tradeName" | "systemCode" | "monthlyRunDay">>,
  ) => void;
  removeCompany: (id: string) => void;
  runSync: (companyId: string, trigger: Execution["trigger"]) => void;
  updateSettings: (patch: Partial<PortalSettings>) => void;
  pathForCompany: (company: Company) => string;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(defaultSettings);

  useEffect(() => {
    const data = loadPersisted();
    setUser(data.user);
    setCompanies(data.companies);
    setExecutions(data.executions);
    setSettings(data.settings);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    const payload: Persisted = { user, companies, executions, settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, user, companies, executions, settings]);

  const login = useCallback((email: string, _password: string) => {
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    setUser({ email: trimmed });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const pathForCompany = useCallback(
    (company: Company) => {
      const root = settings.localRootPath.replace(/[/\\]+$/, "");
      const safeCode = company.systemCode.replace(/[/\\?%*:|"<>]/g, "-");
      return `${root}\\${company.cnpjDigits}\\${safeCode}`;
    },
    [settings.localRootPath],
  );

  const addCompany = useCallback(
    (input: {
      cnpjDigits: string;
      tradeName: string;
      systemCode: string;
      monthlyRunDay?: number;
    }) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `co-${Date.now()}`;
      const company: Company = {
        id,
        cnpjDigits: input.cnpjDigits,
        tradeName: input.tradeName.trim(),
        systemCode: input.systemCode.trim(),
        monthlyRunDay: hydrateMonthlyRunDay(input.monthlyRunDay),
        createdAt: new Date().toISOString(),
      };
      const startedAt = new Date().toISOString();
      const exec: Execution = {
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
      setCompanies((prev) => [company, ...prev]);
      setExecutions((prev) => [exec, ...prev]);
      return company;
    },
    [],
  );

  const updateCompany = useCallback(
    (
      id: string,
      patch: Partial<Pick<Company, "tradeName" | "systemCode" | "monthlyRunDay">>,
    ) => {
      setCompanies((prev) =>
        prev.map((c) => {
          if (c.id !== id) {
            return c;
          }
          const next = { ...c, ...patch };
          if (patch.monthlyRunDay !== undefined) {
            next.monthlyRunDay = hydrateMonthlyRunDay(patch.monthlyRunDay);
          }
          return next;
        }),
      );
    },
    [],
  );

  const removeCompany = useCallback((id: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setExecutions((prev) => prev.filter((e) => e.companyId !== id));
  }, []);

  const runSync = useCallback((companyId: string, trigger: Execution["trigger"]) => {
    const company = companies.find((c) => c.id === companyId);
    if (!company) {
      return;
    }
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ex-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const running: Execution = {
      id,
      companyId,
      companyCnpjDigits: company.cnpjDigits,
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
  }, [companies]);

  const updateSettings = useCallback((patch: Partial<PortalSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<PortalContextValue>(
    () => ({
      hydrated,
      user,
      companies,
      executions,
      settings,
      login,
      logout,
      addCompany,
      updateCompany,
      removeCompany,
      runSync,
      updateSettings,
      pathForCompany,
    }),
    [
      hydrated,
      user,
      companies,
      executions,
      settings,
      login,
      logout,
      addCompany,
      updateCompany,
      removeCompany,
      runSync,
      updateSettings,
      pathForCompany,
    ],
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

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
import type { Company, PortalSettings } from "@repo/shared";
import { mirrorDestinationFolderName } from "@/lib/mirror-destination-preview";

const STORAGE_KEY = "portal-automacao-nf.settings.v1";

const defaultSettings: PortalSettings = {
  localRootPath: "C:\\NFs",
  notifyEmailOnFailure: true,
  timezone: "America/Sao_Paulo",
};

function loadSettings(): PortalSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }
    const parsed = JSON.parse(raw) as Partial<PortalSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

type PortalContextValue = {
  hydrated: boolean;
  settings: PortalSettings;
  updateSettings: (patch: Partial<PortalSettings>) => void;
  /** Pré-visualização local no browser — o caminho efectivo do worker vem do servidor (Configurações). */
  pathForCompany: (company: Pick<Company, "cnpjDigits" | "systemCode" | "tradeName">) => string;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<PortalSettings>(defaultSettings);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [hydrated, settings]);

  const pathForCompany = useCallback(
    (company: Pick<Company, "cnpjDigits" | "systemCode" | "tradeName">) => {
      const root = settings.localRootPath.replace(/[/\\]+$/, "");
      const sub = mirrorDestinationFolderName(
        company.systemCode,
        company.tradeName,
        company.cnpjDigits,
      );
      return `${root}\\${sub}`;
    },
    [settings.localRootPath],
  );

  const updateSettings = useCallback((patch: Partial<PortalSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<PortalContextValue>(
    () => ({
      hydrated,
      settings,
      updateSettings,
      pathForCompany,
    }),
    [hydrated, settings, updateSettings, pathForCompany],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal must be used within PortalProvider");
  }
  return ctx;
}

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

export type AppSessionUser = {
  id: string;
  email: string;
  name: string;
  isSuperadmin?: boolean;
};

export type AppSessionRow = {
  id: string;
  activeCompanyId?: string | null;
  activeOrganizationId?: string | null;
};

export type AppSessionData = {
  user: AppSessionUser;
  session: AppSessionRow;
};

function normalizeSession(json: unknown): AppSessionData | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const root = (json as { data?: unknown }).data ?? json;
  if (!root || typeof root !== "object") {
    return null;
  }
  const o = root as Record<string, unknown>;
  const user = o.user as AppSessionUser | undefined;
  const session = o.session as AppSessionRow | undefined;
  if (!user || !session) {
    return null;
  }
  return { user, session };
}

type Ctx = {
  data: AppSessionData | null;
  isPending: boolean;
  /** soft=true: atualiza sessão sem mostrar o estado global de carregamento inicial */
  refetch: (soft?: boolean) => Promise<void>;
};

const AppSessionContext = createContext<Ctx | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppSessionData | null>(null);
  const [isPending, setIsPending] = useState(true);

  const refetch = useCallback(async (soft?: boolean) => {
    if (!soft) {
      setIsPending(true);
    }
    try {
      const res = await fetch("/api/auth/get-session", { credentials: "include" });
      const json = (await res.json()) as unknown;
      setData(normalizeSession(json));
    } catch {
      setData(null);
    } finally {
      if (!soft) {
        setIsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<Ctx>(
    () => ({
      data,
      isPending,
      refetch,
    }),
    [data, isPending, refetch],
  );

  return (
    <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }
  return ctx;
}

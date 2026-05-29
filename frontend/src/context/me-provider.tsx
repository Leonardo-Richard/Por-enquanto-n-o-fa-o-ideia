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
import { useAppSession } from "@/context/app-session";
import { apiFetch } from "@/lib/api-client";

export type MeData = {
  effectiveOrganizationId: string | null;
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  activeCompanyId: string | null;
  isSuperadmin: boolean;
};

type MeContextValue = {
  data: MeData | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const MeContext = createContext<MeContextValue | null>(null);

function parseMeBody(body: Record<string, unknown> | null): MeData | null {
  if (!body) {
    return null;
  }
  return {
    effectiveOrganizationId:
      typeof body.effectiveOrganizationId === "string" ? body.effectiveOrganizationId : null,
    activeOrganizationId:
      typeof body.activeOrganizationId === "string" ? body.activeOrganizationId : null,
    activeOrganizationName:
      typeof body.activeOrganizationName === "string" ? body.activeOrganizationName : null,
    activeCompanyId: typeof body.activeCompanyId === "string" ? body.activeCompanyId : null,
    isSuperadmin: Boolean(body.isSuperadmin),
  };
}

export function MeProvider({ children }: { children: ReactNode }) {
  const { data: sessionData, isPending } = useAppSession();
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!sessionData?.user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/me");
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setData(null);
        return;
      }
      setData(parseMeBody(body));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sessionData?.user]);

  useEffect(() => {
    if (isPending) {
      return;
    }
    void reload();
  }, [isPending, reload, sessionData?.user?.id]);

  const value = useMemo<MeContextValue>(
    () => ({
      data,
      loading: isPending || loading,
      reload,
    }),
    [data, isPending, loading, reload],
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) {
    throw new Error("useMe must be used within MeProvider");
  }
  return ctx;
}

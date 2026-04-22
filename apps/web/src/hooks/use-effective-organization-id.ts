"use client";

import { useCallback, useEffect, useState } from "react";

export type MeSummary = {
  effectiveOrganizationId: string | null;
  activeOrganizationName: string | null;
};

export function useMeSummary() {
  const [data, setData] = useState<MeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/me", { credentials: "include" });
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !body) {
        setData(null);
        return;
      }
      setData({
        effectiveOrganizationId:
          typeof body.effectiveOrganizationId === "string" ? body.effectiveOrganizationId : null,
        activeOrganizationName:
          typeof body.activeOrganizationName === "string" ? body.activeOrganizationName : null,
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    effectiveOrganizationId: data?.effectiveOrganizationId ?? null,
    activeOrganizationName: data?.activeOrganizationName ?? null,
    loading,
    reload,
  };
}

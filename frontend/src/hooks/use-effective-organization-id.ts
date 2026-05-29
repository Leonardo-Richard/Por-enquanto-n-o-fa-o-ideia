"use client";

import { useMe } from "@/context/me-provider";

export type MeSummary = {
  effectiveOrganizationId: string | null;
  activeOrganizationName: string | null;
};

/** @deprecated Prefer `useMe()` — mantido para imports existentes. */
export function useMeSummary() {
  const { data, loading, reload } = useMe();
  return {
    effectiveOrganizationId: data?.effectiveOrganizationId ?? null,
    activeOrganizationName: data?.activeOrganizationName ?? null,
    loading,
    reload,
  };
}

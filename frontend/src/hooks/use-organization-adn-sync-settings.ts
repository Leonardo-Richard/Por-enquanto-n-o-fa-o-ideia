"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

/** Alinhado a `AdnSettingsJson` em `configuracoes/page.tsx` e ao handler GET. */
export type OrganizationAdnSyncSettingsData = {
  localDownloadRoot: string | null;
  adnSyncEnabled: boolean;
  canManage: boolean;
};

export type OrganizationAdnSyncSettingsErrorKind = "http" | "network";

export type UseOrganizationAdnSyncSettingsArgs = {
  organizationId: string;
  /**
   * Quando `false`, não dispara `GET` e repõe estado (ex.: org da empresa ≠ org activa, ou sync ADN `feature_off`).
   */
  fetchEnabled?: boolean;
};

export type UseOrganizationAdnSyncSettingsResult = {
  loading: boolean;
  data: OrganizationAdnSyncSettingsData | null;
  error: { kind: OrganizationAdnSyncSettingsErrorKind } | null;
};

export function useOrganizationAdnSyncSettings({
  organizationId,
  fetchEnabled = true,
}: UseOrganizationAdnSyncSettingsArgs): UseOrganizationAdnSyncSettingsResult {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OrganizationAdnSyncSettingsData | null>(null);
  const [error, setError] = useState<{ kind: OrganizationAdnSyncSettingsErrorKind } | null>(null);

  useEffect(() => {
    if (!fetchEnabled || !organizationId) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);

    void (async () => {
      try {
        const res = await apiFetch(`/api/v1/organizations/${organizationId}/adn-sync-settings`, {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setData(null);
          setError({ kind: "http" });
          return;
        }
        const j = (await res.json()) as Partial<OrganizationAdnSyncSettingsData>;
        if (cancelled) {
          return;
        }
        setError(null);
        setData({
          localDownloadRoot:
            typeof j.localDownloadRoot === "string" || j.localDownloadRoot === null
              ? j.localDownloadRoot
              : null,
          adnSyncEnabled: typeof j.adnSyncEnabled === "boolean" ? j.adnSyncEnabled : false,
          canManage: typeof j.canManage === "boolean" ? j.canManage : false,
        });
      } catch {
        if (!cancelled) {
          setData(null);
          setError({ kind: "network" });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, fetchEnabled]);

  return { loading, data, error };
}

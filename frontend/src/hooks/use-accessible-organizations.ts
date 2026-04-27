"use client";

import { useCallback, useEffect, useState } from "react";
import {
  classifyThrownFetchError,
  FE_API_COPY,
  messageForFailedResponse,
  type FeApiFailureKind,
} from "@/lib/fe-api-error";

export type AccessibleOrganization = {
  id: string;
  name: string;
  tradeName: string | null;
  taxIdMasked: string | null;
  memberCount: number;
  active: boolean;
  canOpenOrgAdmin: boolean;
  canManageUsers: boolean;
};

export type AccessibleOrganizationsIssue = {
  kind: FeApiFailureKind;
  message: string;
};

export function useAccessibleOrganizations() {
  const [data, setData] = useState<AccessibleOrganization[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<AccessibleOrganizationsIssue | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setIssue(null);
    try {
      const res = await fetch("/api/v1/organizations/accessible?page=1&pageSize=100", {
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const { kind, text } = messageForFailedResponse(res.status, body);
        setIssue({ kind, message: text });
        setData(null);
        return;
      }
      const parsed = body as { items?: AccessibleOrganization[] };
      setData(parsed.items ?? []);
    } catch (e) {
      const net = classifyThrownFetchError(e);
      if (net === "network") {
        setIssue({ kind: "network", message: FE_API_COPY.network });
      } else {
        setIssue({ kind: "5xx", message: FE_API_COPY.service5xx });
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    organizations: data,
    loading,
    error: issue?.message ?? null,
    issue,
    reload,
  };
}

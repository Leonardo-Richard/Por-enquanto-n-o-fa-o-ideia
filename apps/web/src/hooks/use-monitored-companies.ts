"use client";

import { useCallback, useEffect, useState } from "react";
import type { Company } from "@repo/shared";
import {
  classifyThrownFetchError,
  FE_API_COPY,
  messageForFailedResponse,
  type FeApiFailureKind,
} from "@/lib/fe-api-error";

export type MonitoredCompanyRow = Company & { cnpjMasked: string; active: boolean };

export type MonitoredCompaniesIssue = {
  kind: FeApiFailureKind;
  message: string;
};

/**
 * TanStack Query key sugerida: ['monitored-companies', organizationId] (ORG-08).
 */
export function useMonitoredCompanies(organizationId: string | null | undefined) {
  const [data, setData] = useState<MonitoredCompanyRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<MonitoredCompaniesIssue | null>(null);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setData([]);
      setIssue(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setIssue(null);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/monitored-companies?page=1&pageSize=100`,
        { credentials: "include" },
      );
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const { kind, text } = messageForFailedResponse(res.status, body);
        setIssue({ kind, message: text });
        setData(null);
        return;
      }
      const parsed = body as { items?: MonitoredCompanyRow[] };
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
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    companies: data,
    loading,
    issue,
    reload,
  };
}

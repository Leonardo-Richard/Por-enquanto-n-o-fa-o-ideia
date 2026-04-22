"use client";

import { useCallback, useEffect, useState } from "react";
import {
  classifyThrownFetchError,
  FE_API_COPY,
  messageForFailedResponse,
  type FeApiFailureKind,
} from "@/lib/fe-api-error";

export type AccessibleCompany = {
  id: string;
  tradeName: string;
  cnpjMasked: string;
  systemCode: string;
  memberCount: number;
  active: boolean;
  canOpenCompanyAdmin: boolean;
  canManageUsers: boolean;
};

export type AccessibleCompaniesIssue = {
  kind: FeApiFailureKind;
  message: string;
};

/**
 * Lista empresas acessíveis via API. Em erro, expõe `issue` e `reload()` —
 * quem renderizar retry deve usar texto visível «Tentar novamente» ou
 * `FE_API_COPY.retryAriaLabel` (SB-04 AC7).
 */
export function useAccessibleCompanies() {
  const [data, setData] = useState<AccessibleCompany[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<AccessibleCompaniesIssue | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setIssue(null);
    try {
      const res = await fetch("/api/v1/companies/accessible?page=1&pageSize=100", {
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const { kind, text } = messageForFailedResponse(res.status, body);
        setIssue({ kind, message: text });
        setData(null);
        return;
      }
      const parsed = body as { items?: AccessibleCompany[] };
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
    companies: data,
    loading,
    /** @deprecated Prefer `issue` — mantido para compatibilidade com chamadas existentes. */
    error: issue?.message ?? null,
    issue,
    reload,
  };
}

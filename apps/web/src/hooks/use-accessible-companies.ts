"use client";

import { useCallback, useEffect, useState } from "react";

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

export function useAccessibleCompanies() {
  const [data, setData] = useState<AccessibleCompany[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/companies/accessible?page=1&pageSize=100", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Falha ao carregar empresas.");
      }
      const body = (await res.json()) as { items: AccessibleCompany[] };
      setData(body.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { companies: data, loading, error, reload };
}

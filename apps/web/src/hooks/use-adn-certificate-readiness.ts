"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdnCertificateReadinessResponse } from "@/lib/adn-certificate-readiness-schema";
import {
  fetchCertificateReadiness,
  postCertificateReadinessVerify,
} from "@/lib/adn-certificate-readiness-client";

export type UseAdnCertificateReadinessAccess = "loading" | "active" | "feature_off" | "forbidden" | "error";

export function useAdnCertificateReadiness({
  organizationId,
  companyId,
}: {
  organizationId: string;
  companyId: string;
}) {
  const [access, setAccess] = useState<UseAdnCertificateReadinessAccess>("loading");
  const [data, setData] = useState<AdnCertificateReadinessResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setAccess("loading");
    setVerifyError(null);
    const r = await fetchCertificateReadiness(organizationId, companyId);
    if (r.kind === "feature_off") {
      setAccess("feature_off");
      setData(null);
      return;
    }
    if (r.kind === "forbidden") {
      setAccess("forbidden");
      setData(null);
      return;
    }
    if (r.kind === "error") {
      setAccess("error");
      setData(null);
      return;
    }
    setAccess("active");
    setData(r.data);
  }, [companyId, organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verify = useCallback(async (): Promise<
    | { kind: "ok"; data: AdnCertificateReadinessResponse }
    | { kind: "forbidden" }
    | { kind: "rate_limited" }
    | { kind: "error" }
  > => {
    setBusy(true);
    setVerifyError(null);
    try {
      const r = await postCertificateReadinessVerify(organizationId, companyId);
      if (r.kind === "ok") {
        setData(r.data);
        setAccess("active");
        return { kind: "ok", data: r.data };
      }
      if (r.kind === "forbidden") {
        setVerifyError(r.message ?? "Não tem permissão para verificar o certificado.");
        return { kind: "forbidden" };
      }
      if (r.kind === "rate_limited") {
        setVerifyError(r.message);
        return { kind: "rate_limited" };
      }
      setVerifyError(r.message);
      return { kind: "error" };
    } finally {
      setBusy(false);
    }
  }, [companyId, organizationId]);

  return {
    access,
    data,
    busy,
    verifyError,
    refresh,
    verify,
  };
}

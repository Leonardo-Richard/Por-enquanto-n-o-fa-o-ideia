import type { AdnCertificateReadinessResponse } from "@/lib/adn-certificate-readiness-schema";

export function buildCertificateReadinessUrl(organizationId: string, companyId: string): string {
  return `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/certificate-readiness`;
}

export function buildCertificateReadinessVerifyUrl(organizationId: string, companyId: string): string {
  return `${buildCertificateReadinessUrl(organizationId, companyId)}/verify`;
}

export type CertificateReadinessGetResult =
  | { kind: "ok"; data: AdnCertificateReadinessResponse }
  | { kind: "feature_off" }
  | { kind: "forbidden" }
  | { kind: "error" };

export async function fetchCertificateReadiness(
  organizationId: string,
  companyId: string,
  fetchFn: typeof fetch = fetch,
): Promise<CertificateReadinessGetResult> {
  const r = await fetchFn(buildCertificateReadinessUrl(organizationId, companyId), {
    credentials: "include",
  });
  if (r.status === 404) {
    return { kind: "feature_off" };
  }
  if (r.status === 403) {
    return { kind: "forbidden" };
  }
  if (r.status === 401) {
    return { kind: "forbidden" };
  }
  if (!r.ok) {
    return { kind: "error" };
  }
  const data = (await r.json()) as AdnCertificateReadinessResponse;
  return { kind: "ok", data };
}

export type CertificateReadinessVerifyResult =
  | { kind: "ok"; data: AdnCertificateReadinessResponse }
  | { kind: "forbidden"; message?: string }
  | { kind: "rate_limited"; retryAfterSeconds: number | null; message: string }
  | { kind: "other_error"; message: string };

export async function postCertificateReadinessVerify(
  organizationId: string,
  companyId: string,
  fetchFn: typeof fetch = fetch,
): Promise<CertificateReadinessVerifyResult> {
  const r = await fetchFn(buildCertificateReadinessVerifyUrl(organizationId, companyId), {
    method: "POST",
    credentials: "include",
  });
  if (r.status === 200) {
    const data = (await r.json()) as AdnCertificateReadinessResponse;
    return { kind: "ok", data };
  }
  if (r.status === 403) {
    const j = (await r.json().catch(() => null)) as { message?: string } | null;
    return { kind: "forbidden", message: j?.message };
  }
  if (r.status === 429) {
    const j = (await r.json().catch(() => null)) as {
      message?: string;
      retryAfterSeconds?: number;
    } | null;
    const retryAfterSeconds =
      typeof j?.retryAfterSeconds === "number" && Number.isFinite(j.retryAfterSeconds)
        ? j.retryAfterSeconds
        : null;
    const base =
      j?.message ??
      "Verificou demasiadas vezes. Aguarde alguns minutos antes de tentar novamente.";
    const message =
      retryAfterSeconds !== null
        ? `${base} (tente novamente em ~${retryAfterSeconds}s)`
        : base;
    return { kind: "rate_limited", retryAfterSeconds, message };
  }
  const j = (await r.json().catch(() => null)) as { message?: string } | null;
  return { kind: "other_error", message: j?.message ?? "Não foi possível verificar o certificado." };
}

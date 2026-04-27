import { z } from "zod";
import { adnWorkerSignedHeaders, requireAdnWorkerSecret } from "@/lib/adn-hmac";

const probeResponseSchema = z.object({
  ok: z.boolean(),
  error_code: z.string().optional(),
});

export type AdnCertProbeResult =
  | { kind: "ok" }
  | { kind: "worker_error"; errorCode: string }
  | { kind: "timeout" }
  | { kind: "unreachable" };

function probeTimeoutMs(): number {
  const raw = process.env.ADN_CERT_PROBE_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 8000;
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

function probeBaseUrl(): string | null {
  const u = process.env.ADN_WORKER_INTERNAL_BASE_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/+$/, "") : null;
}

function probePath(): string {
  const p = process.env.ADN_CERT_PROBE_PATH?.trim();
  return p && p.startsWith("/") ? p : "/internal/v1/adn/certificate-probe";
}

/** Infra mínima para o *probe* (URL interna + segredo HMAC). */
export function isAdnCertProbeInfraConfigured(): boolean {
  return Boolean(probeBaseUrl() && requireAdnWorkerSecret());
}

/**
 * *Probe* activo: infra configurada e feature não desactivada explicitamente.
 * (`ADN_CERT_PROBE_ENABLED=false` desliga mesmo com URL.)
 */
export function isAdnCertProbeExecutionEnabled(): boolean {
  const flag = process.env.ADN_CERT_PROBE_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0") {
    return false;
  }
  return isAdnCertProbeInfraConfigured();
}

export async function invokeAdnCertificateProbe(
  cnpjDigits: string,
  fetchFn: typeof fetch = fetch,
): Promise<AdnCertProbeResult> {
  const base = probeBaseUrl();
  const secret = requireAdnWorkerSecret();
  if (!base || !secret) {
    return { kind: "unreachable" };
  }

  const bodyStr = JSON.stringify({ cnpj: cnpjDigits });
  const url = `${base}${probePath()}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), probeTimeoutMs());

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: adnWorkerSignedHeaders(secret, bodyStr),
      body: bodyStr,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      if (res.status >= 500 || res.status === 408) {
        return { kind: "timeout" };
      }
      return { kind: "unreachable" };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { kind: "unreachable" };
    }

    const parsed = probeResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { kind: "unreachable" };
    }

    if (parsed.data.ok) {
      return { kind: "ok" };
    }
    const code = parsed.data.error_code?.trim() || "ADN_WORKER_CERT_CONFIG_INVALID";
    return { kind: "worker_error", errorCode: code };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { kind: "timeout" };
    }
    return { kind: "unreachable" };
  } finally {
    clearTimeout(t);
  }
}

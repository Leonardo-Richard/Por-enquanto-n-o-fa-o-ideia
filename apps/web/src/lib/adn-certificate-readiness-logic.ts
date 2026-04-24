import type { AdnCertificateReadinessResponse } from "@/lib/adn-certificate-readiness-schema";
import {
  getReadinessMemoryEntry,
  setReadinessMemoryEntry,
  type ReadinessMemoryEntry,
} from "@/lib/adn-certificate-readiness-memory";
import { invokeAdnCertificateProbe, isAdnCertProbeExecutionEnabled } from "@/lib/adn-cert-probe";
import { isAdnWorkerErrorCode, userMessageForAdnWorkerCode } from "@/lib/adn-worker-errors";

const FRESH_MS = 15 * 60 * 1000;

const ERRO_GENERICO =
  "Não foi possível validar a configuração do certificado. Consulte o guia técnico ou o suporte.";

function parseIsoMs(iso: string | null): number | null {
  if (!iso) {
    return null;
  }
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function materializeFromMemory(
  entry: ReadinessMemoryEntry | null,
  now: Date,
  canVerify: boolean,
  probeAvailable: boolean,
): AdnCertificateReadinessResponse {
  const nowMs = now.getTime();
  const lastCheckedAt = entry?.lastCheckedAtIso ?? null;

  if (!isAdnCertProbeExecutionEnabled()) {
    return {
      certificateReadiness: "pendente_verificacao",
      lastCheckedAt,
      userMessage: null,
      errorCode: null,
      retryAfterSeconds: null,
      probeAvailable,
      canVerify,
    };
  }

  const okAt = parseIsoMs(entry?.lastSuccessfulProbeAtIso ?? null);
  const freshOk =
    entry?.lastProbeMaterialOk === true &&
    okAt !== null &&
    nowMs - okAt <= FRESH_MS;

  if (freshOk) {
    return {
      certificateReadiness: "pronto",
      lastCheckedAt,
      userMessage: null,
      errorCode: null,
      retryAfterSeconds: null,
      probeAvailable,
      canVerify,
    };
  }

  if (entry?.lastProbeMaterialOk === false && entry.lastErrorCode) {
    const code = entry.lastErrorCode;
    const publicCode = isAdnWorkerErrorCode(code) ? code : "ADN_WORKER_CERT_CONFIG_INVALID";
    const msg = userMessageForAdnWorkerCode(code) ?? ERRO_GENERICO;
    return {
      certificateReadiness: "erro",
      lastCheckedAt,
      userMessage: msg,
      errorCode: publicCode,
      retryAfterSeconds: null,
      probeAvailable,
      canVerify,
    };
  }

  return {
    certificateReadiness: "pendente_verificacao",
    lastCheckedAt,
    userMessage: null,
    errorCode: null,
    retryAfterSeconds: null,
    probeAvailable,
    canVerify,
  };
}

export function buildGetCertificateReadinessPayload(
  organizationId: string,
  companyId: string,
  canVerify: boolean,
  now: Date = new Date(),
): AdnCertificateReadinessResponse {
  const entry = getReadinessMemoryEntry(organizationId, companyId);
  const probeAvailable = isAdnCertProbeExecutionEnabled();
  return materializeFromMemory(entry, now, canVerify, probeAvailable);
}

export async function runVerifyAndBuildCertificateReadinessPayload(
  organizationId: string,
  companyId: string,
  cnpjDigits: string,
  canVerify: boolean,
  now: Date = new Date(),
  fetchFn: typeof fetch = fetch,
): Promise<AdnCertificateReadinessResponse> {
  const iso = now.toISOString();

  if (!isAdnCertProbeExecutionEnabled()) {
    const next: ReadinessMemoryEntry = {
      lastCheckedAtIso: iso,
      lastSuccessfulProbeAtIso: null,
      lastProbeMaterialOk: null,
      lastErrorCode: null,
    };
    setReadinessMemoryEntry(organizationId, companyId, next);
    return materializeFromMemory(next, now, canVerify, false);
  }

  const probe = await invokeAdnCertificateProbe(cnpjDigits, fetchFn);

  let next: ReadinessMemoryEntry;

  if (probe.kind === "ok") {
    next = {
      lastCheckedAtIso: iso,
      lastSuccessfulProbeAtIso: iso,
      lastProbeMaterialOk: true,
      lastErrorCode: null,
    };
  } else if (probe.kind === "worker_error") {
    next = {
      lastCheckedAtIso: iso,
      lastSuccessfulProbeAtIso: null,
      lastProbeMaterialOk: false,
      lastErrorCode: probe.errorCode,
    };
  } else {
    next = {
      lastCheckedAtIso: iso,
      lastSuccessfulProbeAtIso: null,
      lastProbeMaterialOk: null,
      lastErrorCode: null,
    };
  }

  setReadinessMemoryEntry(organizationId, companyId, next);
  return materializeFromMemory(next, now, canVerify, true);
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGetCertificateReadinessPayload } from "@/lib/adn-certificate-readiness-logic";
import { clearAllReadinessMemoryForTests, setReadinessMemoryEntry } from "@/lib/adn-certificate-readiness-memory";

describe("buildGetCertificateReadinessPayload — UIP-03 AC3 (frescura 15 min, relógio portal)", () => {
  const org = "00000000-0000-4000-8000-000000000001";
  const company = "00000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    clearAllReadinessMemoryForTests();
    vi.stubEnv("ADN_CERT_PROBE_ENABLED", "true");
    vi.stubEnv("ADN_WORKER_INTERNAL_BASE_URL", "http://worker.test");
    vi.stubEnv("ADN_WORKER_HMAC_SECRET", "0123456789abcdef0123456789abcdef");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearAllReadinessMemoryForTests();
  });

  it("com último probe ok há 5 min → pronto", () => {
    const now = new Date("2026-04-24T14:00:00.000Z");
    const okAt = new Date("2026-04-24T13:55:00.000Z").toISOString();
    setReadinessMemoryEntry(org, company, {
      lastCheckedAtIso: okAt,
      lastSuccessfulProbeAtIso: okAt,
      lastProbeMaterialOk: true,
      lastErrorCode: null,
    });
    const p = buildGetCertificateReadinessPayload(org, company, true, now);
    expect(p.certificateReadiness).toBe("pronto");
    expect(p.probeAvailable).toBe(true);
  });

  it("com último probe ok há > 15 min → pendente_verificacao", () => {
    const now = new Date("2026-04-24T14:00:00.000Z");
    const okAt = new Date("2026-04-24T13:44:00.000Z").toISOString();
    setReadinessMemoryEntry(org, company, {
      lastCheckedAtIso: okAt,
      lastSuccessfulProbeAtIso: okAt,
      lastProbeMaterialOk: true,
      lastErrorCode: null,
    });
    const p = buildGetCertificateReadinessPayload(org, company, true, now);
    expect(p.certificateReadiness).toBe("pendente_verificacao");
  });

  it("com probe desactivado (flag false) → pendente e probeAvailable false", () => {
    vi.stubEnv("ADN_CERT_PROBE_ENABLED", "false");
    const now = new Date("2026-04-24T14:00:00.000Z");
    setReadinessMemoryEntry(org, company, {
      lastCheckedAtIso: now.toISOString(),
      lastSuccessfulProbeAtIso: now.toISOString(),
      lastProbeMaterialOk: true,
      lastErrorCode: null,
    });
    const p = buildGetCertificateReadinessPayload(org, company, true, now);
    expect(p.certificateReadiness).toBe("pendente_verificacao");
    expect(p.probeAvailable).toBe(false);
  });
});

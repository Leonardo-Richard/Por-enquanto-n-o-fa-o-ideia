import { NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/authz";
import { jsonError } from "@/server/api/v1/lib/errors";
import { getAuthedSession } from "@/server/api/v1/lib/session";

/** Janela rolling pedida pelo cliente (minutos), para relatórios posteriores / MSSYS-07. */
export function parseOpsWindowMinutes(searchParams: URLSearchParams): number {
  const raw = searchParams.get("windowMinutes") ?? searchParams.get("window") ?? "60";
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) {
    return 60;
  }
  return Math.min(24 * 60, Math.max(5, n));
}

/**
 * MSYS-07 — leitura agregada (superadmin). Resposta MVP: `partial: true` até existirem séries reais.
 * Query: `windowMinutes` ou `window` (5–1440), default 60.
 */
export async function handleGetOpsMetrics(request: Request) {
  const session = await getAuthedSession(request);
  if (!session) {
    return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
  }
  if (!isSuperadmin(session.user)) {
    return jsonError(403, "Não tem permissão para esta operação.");
  }
  const url = new URL(request.url);
  const windowMinutes = parseOpsWindowMinutes(url.searchParams);

  return NextResponse.json({
    schemaVersion: "2026-04-28",
    partial: true,
    windowMinutes,
    windowLabel: `${windowMinutes}m`,
    adn: {
      queueDepth: null as number | null,
      jobsSucceeded: null as number | null,
      jobsFailed: null as number | null,
      p95SyncLatencyMs: null as number | null,
      rate429PerMin: null as number | null,
    },
    certificate: {
      registrationFailures: null as number | null,
    },
    correlation: {
      note:
        "Campos numéricos serão preenchidos quando a fonte agregada estiver ligada; usar organizationId/companyId/jobId nos logs de backend para correlacionar.",
    },
    generatedAt: new Date().toISOString(),
  });
}

export async function handleGetOpsAlerts(request: Request) {
  const session = await getAuthedSession(request);
  if (!session) {
    return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
  }
  if (!isSuperadmin(session.user)) {
    return jsonError(403, "Não tem permissão para esta operação.");
  }
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") !== "0";
  const windowMinutes = parseOpsWindowMinutes(url.searchParams);

  return NextResponse.json({
    schemaVersion: "2026-04-28",
    partial: true,
    windowMinutes,
    activeOnly,
    alerts: [] as Array<{
      id: string;
      severity: "critical" | "warning";
      title: string;
      since: string;
      context?: Record<string, string>;
    }>,
    generatedAt: new Date().toISOString(),
  });
}

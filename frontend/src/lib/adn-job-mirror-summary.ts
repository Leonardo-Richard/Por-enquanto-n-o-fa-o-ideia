/**
 * Extrai métricas de espelho no disco (worker `mirror_local` / `remirror_job`)
 * a partir de `summary` do job ADN (camelCase no JSON da API).
 */

export type AdnJobMirrorSummaryUi = {
  /** Há contadores mirrorWritten / mirrorFailed no resumo. */
  hasMirrorMetrics: boolean;
  written: number;
  failed: number;
  hadFailures: boolean;
  errorsSample: string[];
  engine: string | undefined;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function mirrorSummaryFromJobSummary(
  summary: Record<string, unknown> | null | undefined,
): AdnJobMirrorSummaryUi | null {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  const engine = typeof summary.engine === "string" ? summary.engine : undefined;
  const hasMirrorMetrics = "mirrorWritten" in summary || "mirrorFailed" in summary;
  const mirrorRelevantEngine = engine === "NFSE_dist" || engine === "remirror_from_storage";

  if (!hasMirrorMetrics && !mirrorRelevantEngine) {
    return null;
  }

  const written = num(summary.mirrorWritten);
  const failed = num(summary.mirrorFailed);
  const hadFailures = summary.mirrorHadFailures === true || failed > 0;

  const sample = Array.isArray(summary.mirrorErrorsSample)
    ? summary.mirrorErrorsSample.filter((x): x is string => typeof x === "string").slice(0, 3)
    : [];

  return {
    hasMirrorMetrics,
    written,
    failed,
    hadFailures,
    errorsSample: sample,
    engine,
  };
}

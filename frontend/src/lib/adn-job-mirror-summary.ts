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
  /** Caminho absoluto onde o worker tentou gravar (subpasta «código - CNPJ»). */
  destinationPath: string | null;
  /** Quantos .xml o worker encontrou em NFSE_dist/data/<CNPJ>/ (só fluxo NFSE_dist). */
  sourceXmlCount: number | null;
  /** Mensagem curta vinda do worker (diagnóstico). */
  operationalHint: string | null;
  skipReason: string | null;
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
  const hasOperationalHint = typeof summary.mirrorOperationalHint === "string";

  if (!hasMirrorMetrics && !mirrorRelevantEngine && !hasOperationalHint) {
    return null;
  }

  const written = num(summary.mirrorWritten);
  const failed = num(summary.mirrorFailed);
  const hadFailures = summary.mirrorHadFailures === true || failed > 0;

  const sample = Array.isArray(summary.mirrorErrorsSample)
    ? summary.mirrorErrorsSample.filter((x): x is string => typeof x === "string").slice(0, 3)
    : [];

  const destinationPath =
    typeof summary.mirrorDestinationPath === "string" && summary.mirrorDestinationPath.trim().length > 0
      ? summary.mirrorDestinationPath.trim()
      : null;
  const sourceXmlRaw = summary.mirrorSourceXmlCount;
  const sourceXmlCount =
    typeof sourceXmlRaw === "number" && Number.isFinite(sourceXmlRaw)
      ? sourceXmlRaw
      : typeof sourceXmlRaw === "string" && sourceXmlRaw.trim() !== ""
        ? Number(sourceXmlRaw)
        : null;
  const operationalHint =
    typeof summary.mirrorOperationalHint === "string" && summary.mirrorOperationalHint.trim().length > 0
      ? summary.mirrorOperationalHint.trim()
      : null;
  const skipReason =
    typeof summary.mirrorSkipReason === "string" && summary.mirrorSkipReason.trim().length > 0
      ? summary.mirrorSkipReason.trim()
      : null;

  return {
    hasMirrorMetrics,
    written,
    failed,
    hadFailures,
    errorsSample: sample,
    engine,
    destinationPath,
    sourceXmlCount: sourceXmlCount !== null && Number.isFinite(sourceXmlCount) ? sourceXmlCount : null,
    operationalHint,
    skipReason,
  };
}

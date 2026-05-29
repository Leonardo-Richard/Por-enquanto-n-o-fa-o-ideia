/** Preserva telemetria existente ao actualizar `summary_json` de um job ADN. */
export function mergeAdnJobSummary(
  prior: unknown,
  fragment: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    prior && typeof prior === "object" && !Array.isArray(prior)
      ? (prior as Record<string, unknown>)
      : {};
  return { ...base, ...fragment };
}

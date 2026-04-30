/**
 * Rótulos e copy seguros para a lista Execuções (FR-ADN-B-04, spec UX §4–5).
 * Não expor nomes de ferramentas internas na UI pública.
 */

export function downloadEngineLabel(downloadEngine: string | undefined | null): string {
  const v = (downloadEngine || "").trim().toLowerCase();
  if (!v || v === "nfse_dist") {
    return "Recolha padrão";
  }
  if (v === "playwright_extension") {
    return "Recolha automatizada";
  }
  return "Recolha padrão";
}

/** Mensagem útil para falhas com failureCategory; sem stack nem JSON bruto. */
export function failureCategoryUserMessage(category: string | undefined | null): string | null {
  switch ((category || "").trim()) {
    case "session":
      return "A sessão de acesso ao serviço nacional não está disponível ou precisa de renovação.";
    case "portal":
      return "O portal oficial está ocupado ou em manutenção. Tente novamente mais tarde.";
    case "extension":
      return "A recolha automatizada não foi concluída. O incidente foi registado para análise.";
    case "disk":
      return "Não foi possível guardar os documentos no ambiente de automação. Contacte o suporte se persistir.";
    case "timeout":
      return "A operação demorou mais do que o permitido e foi interrompida. Pode tentar novamente mais tarde.";
    case "unknown":
      return "Não foi possível concluir a operação. Tente novamente ou contacte o suporte.";
    default:
      return null;
  }
}

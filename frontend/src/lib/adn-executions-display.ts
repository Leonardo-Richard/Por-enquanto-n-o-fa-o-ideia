/**
 * Rótulos e copy seguros para execuções ADN (lista, dashboard, overview).
 */

export type AdnJobSummaryInput = {
  status: string;
  summary?: Record<string, unknown> | null;
};

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

export function adnJobStatusLabel(status: string): string {
  if (status === "running") {
    return "Em execução";
  }
  if (status === "queued") {
    return "Na fila";
  }
  if (status === "failed") {
    return "Falhou";
  }
  if (status === "partial") {
    return "Parcial";
  }
  if (status === "completed") {
    return "Concluída";
  }
  return status;
}

export function adnJobStatusBadgeClass(status: string): string {
  if (status === "running" || status === "queued") {
    return "bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  if (status === "failed") {
    return "bg-red-500/15 text-red-800 dark:text-red-200";
  }
  if (status === "partial") {
    return "bg-sky-500/15 text-sky-900 dark:text-sky-100";
  }
  return "bg-emerald-600/15 text-emerald-900 dark:text-emerald-100";
}

export function isAdnJobInProgress(status: string | null | undefined): boolean {
  return status === "queued" || status === "running";
}

function summaryFailureCategory(summary: Record<string, unknown> | null | undefined): string | undefined {
  if (!summary || typeof summary !== "object") {
    return undefined;
  }
  const fc = summary.failureCategory;
  return typeof fc === "string" ? fc : undefined;
}

export function adnJobDetailLabel(job: AdnJobSummaryInput): string {
  const s = job.summary ?? null;
  if (job.status === "failed") {
    const friendly = failureCategoryUserMessage(summaryFailureCategory(s));
    if (friendly) {
      return friendly;
    }
    const msg = s && typeof s.message === "string" ? s.message.trim() : "";
    if (msg.length > 0 && msg.length <= 200) {
      return msg;
    }
    return "Não foi possível concluir a operação.";
  }
  if (job.status === "queued") {
    return "Aguardando o worker de recolha.";
  }
  if (job.status === "running") {
    return "Recolha em curso.";
  }
  if (job.status === "completed" || job.status === "partial") {
    const ax = typeof s?.artifactsXml === "number" ? s.artifactsXml : null;
    const ap = typeof s?.artifactsPdf === "number" ? s.artifactsPdf : null;
    if (ax != null || ap != null) {
      const parts: string[] = [];
      if (ax != null) {
        parts.push(`${ax} XML`);
      }
      if (ap != null) {
        parts.push(`${ap} PDF`);
      }
      return parts.join(", ");
    }
  }
  return "—";
}

export function formatAdnJobRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return "";
  }
  const diffMs = Date.now() - t;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) {
    return "agora";
  }
  if (diffMin < 60) {
    return `há ${diffMin} min`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 48) {
    return `há ${diffH} h`;
  }
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

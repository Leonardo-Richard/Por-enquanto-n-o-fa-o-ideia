import { messageFromApiJson } from "./api-error-message";

/** Copy mínima (PT) — SB-04 / front-end-spec. */
export const FE_API_COPY = {
  service5xx: "Não foi possível ligar ao serviço. Tente novamente dentro de instantes.",
  network: "Verifique a sua ligação à internet e tente novamente.",
  session401: "Sessão expirada. Inicie sessão novamente.",
  forbidden403: "Não tem permissão para esta operação.",
  /** Outros 4xx (ex.: 404) — não confundir com indisponibilidade de servidor (5xx). */
  clientOther: "Não foi possível concluir o pedido. Tente novamente ou volte mais tarde.",
  retryAriaLabel: "Tentar novamente a carregar os dados",
} as const;

export type FeApiFailureKind = "network" | "5xx" | "401" | "403" | "client";

export function classifyThrownFetchError(e: unknown): FeApiFailureKind | null {
  if (e instanceof TypeError) {
    const m = e.message.toLowerCase();
    if (m.includes("fetch") || m.includes("network") || m.includes("failed to load")) {
      return "network";
    }
  }
  if (e instanceof DOMException && e.name === "AbortError") {
    return "network";
  }
  return null;
}

/** Prioriza `message` do JSON quando seguro (AC4); caso contrário usa a tabela PT. */
export function messageForFailedResponse(status: number, body: unknown): { kind: FeApiFailureKind; text: string } {
  const fromApi = messageFromApiJson(body);
  const lower = fromApi?.toLowerCase() ?? "";
  const unsafe =
    lower.includes("postgresql://") ||
    lower.includes("postgres://") ||
    lower.includes("database_url") ||
    lower.includes("pooler.supabase");
  const safeApi = fromApi && !unsafe && fromApi.length < 400 ? fromApi : undefined;

  if (status === 401) {
    return { kind: "401", text: safeApi ?? FE_API_COPY.session401 };
  }
  if (status === 403) {
    return { kind: "403", text: safeApi ?? FE_API_COPY.forbidden403 };
  }
  if (status >= 500) {
    return { kind: "5xx", text: safeApi ?? FE_API_COPY.service5xx };
  }
  if (status >= 400) {
    return { kind: "client", text: safeApi ?? FE_API_COPY.clientOther };
  }
  return { kind: "5xx", text: safeApi ?? FE_API_COPY.service5xx };
}

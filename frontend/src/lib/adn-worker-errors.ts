/**
 * Mensagens públicas pt-BR para `error_code` emitidos pelo worker ADN (CE-FR10).
 * Contrato e tabela: `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` §5.2.
 *
 * Códigos ADN pré-existentes no portal (extensão aditiva; não redefinir):
 * ADN_INVALID_JSON, ADN_INVALID_SYNC_BODY, ADN_RATE_LIMIT, ADN_INVALID_QUERY,
 * ADN_INVALID_BULK_RETRY, ADN_INVALID_FAILURE_ID, ADN_INVALID_PAYLOAD,
 * ADN_DRAFT_NOT_FOUND, ADN_DRAFT_EXPIRED; STORAGE_COMMIT_FAILED em falhas.
 */

export const ADN_WORKER_ERROR_CODES = [
  "ADN_WORKER_CERT_NOT_FOUND",
  "ADN_WORKER_CERT_CONFIG_INVALID",
  "ADN_WORKER_TLS_ENV_NOT_READY",
  "ADN_WORKER_CERT_STORE_INACCESSIBLE",
] as const;

export type AdnWorkerErrorCode = (typeof ADN_WORKER_ERROR_CODES)[number];

const ADN_WORKER_USER_MESSAGES_PT: Record<AdnWorkerErrorCode, string> = {
  ADN_WORKER_CERT_NOT_FOUND:
    "Não foi possível validar o certificado da empresa no servidor de recolha.",
  ADN_WORKER_CERT_CONFIG_INVALID:
    "A configuração do certificado no servidor está incompleta ou incorrecta.",
  ADN_WORKER_TLS_ENV_NOT_READY:
    "O servidor de recolha não está preparado para ligar ao Ambiente Nacional.",
  ADN_WORKER_CERT_STORE_INACCESSIBLE:
    "O certificado não está acessível ao serviço de recolha. Verifique a instalação.",
};

export function isAdnWorkerErrorCode(code: string): code is AdnWorkerErrorCode {
  return (ADN_WORKER_ERROR_CODES as readonly string[]).includes(code);
}

/** Mensagem sanitizada para API pública; nunca inclui paths, PFX nem `error_detail` de BD. */
export function userMessageForAdnWorkerCode(code: string): string | null {
  if (!isAdnWorkerErrorCode(code)) {
    return null;
  }
  return ADN_WORKER_USER_MESSAGES_PT[code];
}

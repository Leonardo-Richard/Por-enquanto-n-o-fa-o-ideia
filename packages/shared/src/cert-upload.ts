import { z } from "zod";

/** Códigos de erro públicos do upload de certificado (UBR-04 / arquitectura §5). */
export const certUploadErrorCodes = [
  "CERT_UPLOAD_INVALID_FILE",
  "CERT_UPLOAD_EXPECT_MULTIPART",
  "CERT_UPLOAD_BAD_PASSWORD",
  "CERT_UPLOAD_CNPJ_MISMATCH",
  "CERT_UPLOAD_CERT_PERIOD_INVALID",
  "CERT_UPLOAD_FILE_TOO_LARGE",
  "CERT_UPLOAD_RATE_LIMITED",
  "CERT_UPLOAD_STORE_FAILED",
] as const;

export type CertUploadErrorCode = (typeof certUploadErrorCodes)[number];

export const certUploadErrorCodeSchema = z.enum(certUploadErrorCodes);

export const companyCertificateStatusSchema = z.enum([
  "pending_validation",
  "active",
  "revoked",
]);

export type CompanyCertificateStatus = z.infer<typeof companyCertificateStatusSchema>;

export const companyCertificateGetResponseSchema = z.object({
  status: companyCertificateStatusSchema.nullable(),
  /** Data ISO (YYYY-MM-DD) apenas dia UTC; null se sem registo. */
  notAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  capabilities: z.object({
    canUpload: z.boolean(),
  }),
});

export type CompanyCertificateGetResponse = z.infer<typeof companyCertificateGetResponseSchema>;

export const certUploadErrorBodySchema = z.object({
  message: z.string(),
  error_code: certUploadErrorCodeSchema,
});

export type CertUploadErrorBody = z.infer<typeof certUploadErrorBodySchema>;

/** Mensagens públicas (pt-BR) — fonte única FE/BE (spec UX §6 + BR-NFR3). */
export const CERT_UPLOAD_PUBLIC_MESSAGES: Record<CertUploadErrorCode, string> = {
  CERT_UPLOAD_INVALID_FILE: "Use um ficheiro .pfx ou .p12.",
  CERT_UPLOAD_EXPECT_MULTIPART:
    "O pedido deve ser multipart/form-data com os campos file e password.",
  CERT_UPLOAD_BAD_PASSWORD:
    "Não foi possível ler o certificado. Verifique a palavra-passe e o ficheiro.",
  CERT_UPLOAD_CNPJ_MISMATCH: "Este certificado não corresponde ao CNPJ desta empresa.",
  CERT_UPLOAD_CERT_PERIOD_INVALID: "O certificado está expirado ou ainda não é válido.",
  CERT_UPLOAD_FILE_TOO_LARGE: "O ficheiro excede o tamanho máximo permitido.",
  CERT_UPLOAD_RATE_LIMITED:
    "Foram feitos demasiados envios. Aguarde alguns minutos e tente novamente.",
  CERT_UPLOAD_STORE_FAILED:
    "Não foi possível concluir o registo. Tente novamente ou contacte o suporte.",
};

export function certUploadMessageForCode(code: CertUploadErrorCode, maxMb?: number): string {
  const base = CERT_UPLOAD_PUBLIC_MESSAGES[code];
  if (code === "CERT_UPLOAD_FILE_TOO_LARGE" && maxMb != null) {
    return `${base} (${maxMb} MB).`;
  }
  return base;
}

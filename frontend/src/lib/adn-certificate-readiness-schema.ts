import { z } from "zod";

export const certificateReadinessStateSchema = z.enum(["pendente_verificacao", "pronto", "erro"]);

export const adnCertificateReadinessResponseSchema = z.object({
  certificateReadiness: certificateReadinessStateSchema,
  lastCheckedAt: z.union([z.string(), z.null()]),
  userMessage: z.union([z.string(), z.null()]),
  errorCode: z.union([z.string(), z.null()]),
  retryAfterSeconds: z.union([z.number(), z.null()]),
  probeAvailable: z.boolean(),
  /** Indica se o utilizador pode chamar POST …/verify (regra alinhada a `assertAdnOrgAdmin`). */
  canVerify: z.boolean(),
});

export type AdnCertificateReadinessResponse = z.infer<typeof adnCertificateReadinessResponseSchema>;

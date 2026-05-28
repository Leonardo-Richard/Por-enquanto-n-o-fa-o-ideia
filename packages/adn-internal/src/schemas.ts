import { z } from "zod";

export const prepareUploadSchema = z
  .object({
    organizationId: z.string().uuid(),
    companyId: z.string().uuid(),
    accessKey: z.string().length(44),
    sha256: z
      .string()
      .length(64)
      .transform((s) => s.toLowerCase())
      .refine((s) => /^[0-9a-f]+$/.test(s), "sha256 inválido."),
    contentType: z.string().min(1).max(200),
    kind: z.enum(["xml", "pdf"]).default("xml"),
  })
  .strict();

export const commitArtifactSchema = z
  .object({
    artifactDraftId: z.string().uuid(),
    issuedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "issuedAt inválido."),
    byteSize: z.number().int().nonnegative().optional(),
    contentType: z.string().max(200).optional(),
    adnSyncJobId: z.string().uuid().optional(),
  })
  .strict();

export const patchJobSchema = z
  .object({
    organizationId: z.string().uuid(),
    status: z.enum(["queued", "running", "completed", "partial", "failed"]).optional(),
    summaryJson: z.record(z.string(), z.unknown()).optional(),
    workerCorrelationId: z.string().max(500).optional(),
    http429Count: z.number().int().nonnegative().optional(),
    http503Count: z.number().int().nonnegative().optional(),
    startedAt: z.string().datetime({ offset: true }).optional(),
    completedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type PrepareUploadInput = z.infer<typeof prepareUploadSchema>;
export type CommitArtifactInput = z.infer<typeof commitArtifactSchema>;
export type PatchJobInput = z.infer<typeof patchJobSchema>;

export const fetchVaultEnvelopeSchema = z
  .object({
    organizationId: z.string().uuid(),
    companyId: z.string().uuid(),
  })
  .strict();

export type FetchVaultEnvelopeInput = z.infer<typeof fetchVaultEnvelopeSchema>;

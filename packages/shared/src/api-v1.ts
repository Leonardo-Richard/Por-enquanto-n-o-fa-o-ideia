import { z } from "zod";
import { isValidCnpj, sanitizeCnpj } from "./cnpj";

/** Criação de organização por superadmin (`POST /api/v1/organizations`). */
export const organizationCreateBodySchema = z
  .object({
    name: z.string().max(500),
    tradeName: z.string().max(500).nullable().optional(),
    taxIdDigits: z.string().nullable().optional(),
  })
  .transform((val) => {
    const name = val.name.trim();
    const tradeName =
      val.tradeName === undefined || val.tradeName === null
        ? null
        : val.tradeName.trim().length === 0
          ? null
          : val.tradeName.trim();
    let taxIdDigits: string | null = null;
    if (val.taxIdDigits !== undefined && val.taxIdDigits !== null) {
      const d = sanitizeCnpj(val.taxIdDigits);
      taxIdDigits = d.length === 0 ? null : d;
    }
    return { name, tradeName, taxIdDigits };
  })
  .superRefine((val, ctx) => {
    if (val.name.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "Nome obrigatório." });
    }
    if (val.taxIdDigits !== null && val.taxIdDigits.length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taxIdDigits"],
        message: "CNPJ da organização deve ter 14 dígitos.",
      });
    }
  });

export type OrganizationCreateBody = z.infer<typeof organizationCreateBodySchema>;

export const activeCompanyBodySchema = z.object({
  companyId: z.string().uuid(),
});

export const activeOrganizationBodySchema = z.object({
  organizationId: z.string().uuid(),
});

export const companiesAccessibleQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const companyCreateBodySchema = z.object({
  cnpjDigits: z
    .string()
    .transform((s) => sanitizeCnpj(s))
    .refine((d) => d.length === 14 && isValidCnpj(d), "CNPJ inválido"),
  tradeName: z.string().min(1).max(500),
  systemCode: z.string().min(1).max(120),
  monthlyRunDay: z.coerce.number().int().min(1).max(28).optional(),
});

export const membersQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const memberPostBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("link"),
    email: z.string().email(),
    companyRole: z.enum(["user", "admin"]).optional(),
  }),
  z.object({
    mode: z.literal("create"),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(200),
    companyRole: z.enum(["user", "admin"]).optional(),
  }),
]);

export const memberPatchBodySchema = z.object({
  companyRole: z.enum(["user", "admin"]).optional(),
  jobTitle: z.string().max(200).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
});

/** Query `GET /api/v1/organizations/{organizationId}/members` — distinto de `membersQuerySchema` (empresa fiscal). */
export const organizationMembersQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const organizationMemberPostBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("link"),
    email: z.string().email(),
    orgRole: z.enum(["user", "admin"]),
  }),
  z.object({
    mode: z.literal("create"),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(200),
    orgRole: z.enum(["user", "admin"]),
    jobTitle: z.string().max(200).nullable().optional(),
    department: z.string().max(200).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
  }),
]);

export const organizationMemberPatchBodySchema = z.object({
  orgRole: z.enum(["user", "admin"]).optional(),
  jobTitle: z.string().max(200).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
});

/** Corpo JSON de erro estável (NFR33) — membros da organização. */
export const organizationMembersApiErrorBodySchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  code: z
    .enum(["LAST_ORG_ADMIN", "MEMBERSHIP_DUPLICATE", "USER_NOT_FOUND", "USER_EMAIL_CONFLICT"])
    .optional(),
});

export type OrganizationMembersQuery = z.infer<typeof organizationMembersQuerySchema>;
export type OrganizationMemberPostBody = z.infer<typeof organizationMemberPostBodySchema>;
export type OrganizationMemberPatchBody = z.infer<typeof organizationMemberPatchBodySchema>;
export type OrganizationMembersApiErrorBody = z.infer<typeof organizationMembersApiErrorBodySchema>;

/** Item de lista `GET/POST .../members` (SMEM-02). */
export type OrganizationMemberListItem = {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string | null;
  orgRole: "user" | "admin";
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export const companyPatchBodySchema = z.object({
  tradeName: z.string().min(1).max(500).optional(),
  systemCode: z.string().min(1).max(120).optional(),
  monthlyRunDay: z.coerce.number().int().min(1).max(28).optional(),
});

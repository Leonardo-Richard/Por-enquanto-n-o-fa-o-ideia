import { z } from "zod";
import { isValidCnpj, sanitizeCnpj } from "./cnpj";

export const activeCompanyBodySchema = z.object({
  companyId: z.string().uuid(),
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

export const companyPatchBodySchema = z.object({
  tradeName: z.string().min(1).max(500).optional(),
  systemCode: z.string().min(1).max(120).optional(),
  monthlyRunDay: z.coerce.number().int().min(1).max(28).optional(),
});

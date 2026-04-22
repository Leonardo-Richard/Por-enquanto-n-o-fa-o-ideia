/** Tipos e constantes partilhados entre apps (ver docs/architecture.md — packages/shared). */
export const APP_SLUG = "portal-automacao-nf" as const;

export type HealthStatus = {
  status: "ok" | "degraded";
};

export {
  sanitizeCnpj,
  formatCnpj,
  displayCnpjLabel,
  isValidCnpj,
  maskCnpjDigits,
} from "./cnpj";

export {
  activeCompanyBodySchema,
  companiesAccessibleQuerySchema,
  companyCreateBodySchema,
  membersQuerySchema,
  memberPostBodySchema,
  memberPatchBodySchema,
  companyPatchBodySchema,
} from "./api-v1";

export type {
  Company,
  Execution,
  ExecutionStatus,
  ExecutionTrigger,
  PortalSettings,
} from "./portal-types";

export {
  MONTHLY_RUN_DAY_MIN,
  MONTHLY_RUN_DAY_MAX,
  clampMonthlyRunDay,
  hydrateMonthlyRunDay,
  parseMonthlyRunDayFromRequest,
  messageFromMonthlyRunDayParse,
} from "./monthly-run-day";
export type { MonthlyRunDayParseResult } from "./monthly-run-day";

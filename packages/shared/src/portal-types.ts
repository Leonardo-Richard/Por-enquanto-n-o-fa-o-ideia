export type ExecutionStatus = "running" | "success" | "failed";

export type ExecutionTrigger = "signup" | "monthly" | "manual";

export type Company = {
  id: string;
  /** Tenant (organização) dona da empresa monitorada. */
  organizationId: string;
  cnpjDigits: string;
  tradeName: string;
  systemCode: string;
  /** Dia civil da coleta mensal em América/São Paulo (1–28). */
  monthlyRunDay: number;
  createdAt: string;
};

export type Execution = {
  id: string;
  companyId: string;
  companyCnpjDigits: string;
  status: ExecutionStatus;
  trigger: ExecutionTrigger;
  startedAt: string;
  finishedAt?: string;
  detail?: string;
  filesCount?: number;
};

export type PortalSettings = {
  localRootPath: string;
  notifyEmailOnFailure: boolean;
  timezone: string;
};

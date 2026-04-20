export type ExecutionStatus = "running" | "success" | "failed";

export type ExecutionTrigger = "signup" | "monthly" | "manual";

export type Company = {
  id: string;
  cnpjDigits: string;
  tradeName: string;
  systemCode: string;
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

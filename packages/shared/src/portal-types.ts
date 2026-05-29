export type ExecutionStatus = "running" | "success" | "failed";

/** @deprecated Preferir `ExecutionDisplayTrigger` de `adn-job-types` para UI. */
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

/** Próxima coleta automática mensal (GET /api/v1/companies/:id). */
export type MonthlyCollectionPreview = {
  /** Instante nominal 06:00 SP; null se ADN desactivado. */
  scheduledAt: string | null;
  adnSyncEnabled: boolean;
  /** Job `sched_monthly:*` já existe no mês civil SP actual. */
  alreadyEnqueuedThisMonth: boolean;
  /** Próximo agendamento é hoje (dia D em SP). */
  isToday: boolean;
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

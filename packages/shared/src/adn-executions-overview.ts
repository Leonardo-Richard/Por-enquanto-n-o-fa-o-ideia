/** Resposta de GET /api/v1/organizations/:organizationId/adn/executions-overview */

export type AdnExecutionsOverviewCounts = {
  queued: number;
  running: number;
  failed: number;
  completed: number;
  partial: number;
};

export type AdnExecutionsOverviewAttention = {
  failedLast7d: number;
  staleQueued: number;
};

export type AdnExecutionsOverviewLastJob = {
  jobId: string;
  status: import("./adn-job-types").AdnSyncJobStatus;
  trigger: import("./adn-job-types").AdnSyncJobTrigger;
  updatedAt: string;
  detailLabel: string;
};

export type AdnExecutionsOverviewFailure = {
  jobId: string;
  companyId: string;
  companyCnpjMasked: string;
  updatedAt: string;
  detailLabel: string;
};

export type AdnExecutionsOverviewResponse = {
  counts: AdnExecutionsOverviewCounts;
  attention: AdnExecutionsOverviewAttention;
  lastJobByCompanyId: Record<string, AdnExecutionsOverviewLastJob>;
  recentFailures: AdnExecutionsOverviewFailure[];
};

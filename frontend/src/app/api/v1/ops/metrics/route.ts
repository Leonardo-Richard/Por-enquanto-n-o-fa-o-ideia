import { handleGetOpsMetrics } from "@/server/api/v1/handlers/ops-aggregates";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleGetOpsMetrics(request);
}

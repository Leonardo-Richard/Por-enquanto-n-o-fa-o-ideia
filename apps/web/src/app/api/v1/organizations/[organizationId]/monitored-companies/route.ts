import {
  handleGetMonitoredCompanies,
  handlePostMonitoredCompanies,
} from "@/server/api/v1/handlers/monitored-companies";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handleGetMonitoredCompanies(request, organizationId);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handlePostMonitoredCompanies(request, organizationId);
}

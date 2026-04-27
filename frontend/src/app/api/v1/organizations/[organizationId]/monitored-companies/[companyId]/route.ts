import {
  handleDeleteMonitoredCompanyById,
  handleGetMonitoredCompanyById,
  handlePatchMonitoredCompanyById,
} from "@/server/api/v1/handlers/monitored-company-by-id";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handleGetMonitoredCompanyById(request, organizationId, companyId);
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handlePatchMonitoredCompanyById(request, organizationId, companyId);
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handleDeleteMonitoredCompanyById(request, organizationId, companyId);
}

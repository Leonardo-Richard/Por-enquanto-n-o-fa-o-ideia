import { handleGetAdnAutomationExport } from "@/server/api/v1/handlers/adn-automation-export";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handleGetAdnAutomationExport(request, organizationId, companyId);
}

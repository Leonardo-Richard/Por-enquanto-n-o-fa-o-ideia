import { handleGetAdnFailures } from "@/server/api/v1/handlers/adn-failures";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handleGetAdnFailures(request, organizationId, companyId);
}

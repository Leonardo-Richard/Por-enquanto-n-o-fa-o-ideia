import { handleGetAdnExecutionsOverview } from "@/server/api/v1/handlers/adn-executions-overview";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handleGetAdnExecutionsOverview(request, organizationId);
}

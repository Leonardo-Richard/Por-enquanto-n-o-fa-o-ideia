import { handleGetAdnRecentJobsOrg } from "@/server/api/v1/handlers/adn-recent-jobs-org";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handleGetAdnRecentJobsOrg(request, organizationId);
}

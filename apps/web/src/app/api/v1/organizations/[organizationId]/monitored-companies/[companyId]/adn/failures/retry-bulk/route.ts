import { handlePostAdnFailuresRetryBulk } from "@/server/api/v1/handlers/adn-failures";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handlePostAdnFailuresRetryBulk(request, organizationId, companyId);
}

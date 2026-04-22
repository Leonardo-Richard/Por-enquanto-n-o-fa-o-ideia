import { handlePostAdnFailureRetry } from "@/server/api/v1/handlers/adn-failures";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string; failureId: string }> },
) {
  const { organizationId, companyId, failureId } = await ctx.params;
  return handlePostAdnFailureRetry(request, organizationId, companyId, failureId);
}

import { handleGetAdnArtifacts } from "@/server/api/v1/handlers/adn-artifacts";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handleGetAdnArtifacts(request, organizationId, companyId);
}

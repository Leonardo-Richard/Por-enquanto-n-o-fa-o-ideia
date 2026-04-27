import { handleGetAdnSync, handlePostAdnSync } from "@/server/api/v1/handlers/adn-sync";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handleGetAdnSync(request, organizationId, companyId);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handlePostAdnSync(request, organizationId, companyId);
}

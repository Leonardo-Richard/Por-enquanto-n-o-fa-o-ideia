import {
  handleGetOrganizationMembers,
  handlePostOrganizationMembers,
} from "@/server/api/v1/handlers/organization-members";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handleGetOrganizationMembers(request, organizationId);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handlePostOrganizationMembers(request, organizationId);
}

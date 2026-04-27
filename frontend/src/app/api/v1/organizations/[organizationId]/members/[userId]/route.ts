import {
  handleDeleteOrganizationMember,
  handlePatchOrganizationMember,
} from "@/server/api/v1/handlers/organization-member-by-id";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; userId: string }> },
) {
  const { organizationId, userId } = await ctx.params;
  return handlePatchOrganizationMember(request, organizationId, userId);
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; userId: string }> },
) {
  const { organizationId, userId } = await ctx.params;
  return handleDeleteOrganizationMember(request, organizationId, userId);
}

import {
  handleDeleteOrganizationMembership,
  handlePatchOrganizationMembership,
} from "@/server/api/v1/handlers/organization-membership-by-id";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; membershipId: string }> },
) {
  const { organizationId, membershipId } = await context.params;
  return handlePatchOrganizationMembership(request, organizationId, membershipId);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ organizationId: string; membershipId: string }> },
) {
  const { organizationId, membershipId } = await context.params;
  return handleDeleteOrganizationMembership(request, organizationId, membershipId);
}

import {
  handleGetOrganizationAdnSyncSettings,
  handlePatchOrganizationAdnSyncSettings,
} from "@/server/api/v1/handlers/organization-adn-sync-settings";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handleGetOrganizationAdnSyncSettings(request, organizationId);
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await ctx.params;
  return handlePatchOrganizationAdnSyncSettings(request, organizationId);
}

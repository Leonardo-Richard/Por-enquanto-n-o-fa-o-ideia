import { handleGetOrganizationSystemUsers } from "@/server/api/v1/handlers/organization-system-users";

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  return handleGetOrganizationSystemUsers(request, organizationId);
}

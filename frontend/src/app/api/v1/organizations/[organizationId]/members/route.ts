import {
  handleGetOrganizationMembers,
  handlePostOrganizationMembers,
} from "@/server/api/v1/handlers/organization-members";

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  return handleGetOrganizationMembers(request, organizationId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  return handlePostOrganizationMembers(request, organizationId);
}

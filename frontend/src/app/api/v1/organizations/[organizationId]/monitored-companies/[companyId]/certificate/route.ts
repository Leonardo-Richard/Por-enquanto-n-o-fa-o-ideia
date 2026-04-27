import {
  handleDeleteCompanyCertificate,
  handleGetCompanyCertificate,
  handlePostCompanyCertificate,
} from "@/server/api/v1/handlers/company-certificate";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await context.params;
  return handleGetCompanyCertificate(request, organizationId, companyId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await context.params;
  return handlePostCompanyCertificate(request, organizationId, companyId);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await context.params;
  return handleDeleteCompanyCertificate(request, organizationId, companyId);
}

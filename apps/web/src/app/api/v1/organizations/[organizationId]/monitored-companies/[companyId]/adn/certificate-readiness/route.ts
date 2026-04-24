import { handleGetAdnCertificateReadiness } from "@/server/api/v1/handlers/adn-certificate-readiness";

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await context.params;
  return handleGetAdnCertificateReadiness(request, organizationId, companyId);
}

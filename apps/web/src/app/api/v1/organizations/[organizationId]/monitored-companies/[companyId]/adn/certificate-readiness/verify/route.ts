import { handlePostAdnCertificateReadinessVerify } from "@/server/api/v1/handlers/adn-certificate-readiness";

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await context.params;
  return handlePostAdnCertificateReadinessVerify(request, organizationId, companyId);
}

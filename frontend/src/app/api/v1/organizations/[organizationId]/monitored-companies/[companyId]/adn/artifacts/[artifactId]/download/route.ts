import { handleGetAdnArtifactDownload } from "@/server/api/v1/handlers/adn-artifact-download";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string; artifactId: string }> },
) {
  const { organizationId, companyId, artifactId } = await ctx.params;
  return handleGetAdnArtifactDownload(request, organizationId, companyId, artifactId);
}

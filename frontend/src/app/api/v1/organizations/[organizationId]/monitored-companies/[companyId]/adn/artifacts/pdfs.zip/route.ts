import { handleGetAdnArtifactsPdfsZip } from "@/server/api/v1/handlers/adn-artifacts-pdfs-zip";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ organizationId: string; companyId: string }> },
) {
  const { organizationId, companyId } = await ctx.params;
  return handleGetAdnArtifactsPdfsZip(request, organizationId, companyId);
}

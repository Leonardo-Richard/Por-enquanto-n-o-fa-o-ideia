import {
  handleDeleteCompanyById,
  handleGetCompanyById,
  handlePatchCompanyById,
} from "@/server/api/v1/handlers/company-by-id";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  return handleGetCompanyById(request, companyId);
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  return handlePatchCompanyById(request, companyId);
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  return handleDeleteCompanyById(request, companyId);
}

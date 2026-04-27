import {
  handleDeleteCompanyMember,
  handlePatchCompanyMember,
} from "@/server/api/v1/handlers/company-member-by-id";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ companyId: string; userId: string }> },
) {
  const { companyId, userId } = await ctx.params;
  return handlePatchCompanyMember(request, companyId, userId);
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ companyId: string; userId: string }> },
) {
  const { companyId, userId } = await ctx.params;
  return handleDeleteCompanyMember(request, companyId, userId);
}

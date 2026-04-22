import {
  handleGetCompanyMembers,
  handlePostCompanyMembers,
} from "@/server/api/v1/handlers/company-members";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  return handleGetCompanyMembers(request, companyId);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  return handlePostCompanyMembers(request, companyId);
}

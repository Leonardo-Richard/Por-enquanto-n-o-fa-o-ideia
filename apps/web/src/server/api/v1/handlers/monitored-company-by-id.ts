import { and, eq } from "drizzle-orm";
import { companies } from "@repo/db";
import { getDb } from "@/lib/db";
import { jsonError, toPublicApiError } from "../lib/errors";
import { getAuthedSession } from "../lib/session";
import {
  handleDeleteCompanyById,
  handleGetCompanyById,
  handlePatchCompanyById,
} from "./company-by-id";

async function assertMonitoredCompanyInOrg(organizationId: string, companyId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)))
    .limit(1);
  return Boolean(row);
}

export async function handleGetMonitoredCompanyById(request: Request, organizationId: string, companyId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!(await assertMonitoredCompanyInOrg(organizationId, companyId))) {
      return jsonError(404, "Empresa não encontrada.");
    }
    return handleGetCompanyById(request, companyId);
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handlePatchMonitoredCompanyById(request: Request, organizationId: string, companyId: string) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!(await assertMonitoredCompanyInOrg(organizationId, companyId))) {
      return jsonError(404, "Empresa não encontrada.");
    }
    return handlePatchCompanyById(request, companyId);
  } catch (e) {
    return toPublicApiError(e);
  }
}

export async function handleDeleteMonitoredCompanyById(
  request: Request,
  organizationId: string,
  companyId: string,
) {
  try {
    const session = await getAuthedSession(request);
    if (!session) {
      return jsonError(401, "Sessão expirada. Inicie sessão novamente.");
    }
    if (!(await assertMonitoredCompanyInOrg(organizationId, companyId))) {
      return jsonError(404, "Empresa não encontrada.");
    }
    return handleDeleteCompanyById(request, companyId);
  } catch (e) {
    return toPublicApiError(e);
  }
}

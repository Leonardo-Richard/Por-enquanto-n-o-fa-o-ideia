import { and, eq } from "drizzle-orm";
import { companyCertificates, type Db } from "@repo/db";
import type { FetchVaultEnvelopeInput } from "./schemas";
import { assertOrgCompanyAdnEnabled } from "./validate-org-company";
import {
  parseCertificateVaultEnvelope,
  readCertificateVaultPayload,
  type CertificateVaultEnvelopeV1,
} from "./cert-vault-read";
import type { AdnHandlerResult } from "./types";

export async function handleFetchVaultEnvelope(
  db: Db,
  input: FetchVaultEnvelopeInput,
): Promise<AdnHandlerResult<{ envelope: CertificateVaultEnvelopeV1 }>> {
  const { organizationId, companyId } = input;

  const orgCheck = await assertOrgCompanyAdnEnabled(db, organizationId, companyId);
  if (!orgCheck.ok) return orgCheck;

  const [row] = await db
    .select({ vaultRef: companyCertificates.vaultRef, status: companyCertificates.status })
    .from(companyCertificates)
    .where(
      and(
        eq(companyCertificates.organizationId, organizationId),
        eq(companyCertificates.companyId, companyId),
      ),
    )
    .limit(1);

  if (!row || row.status !== "active") {
    return {
      ok: false,
      error: {
        status: 404,
        message: "Certificado activo não encontrado para esta empresa.",
        error_code: "CERT_NOT_ACTIVE",
      },
    };
  }

  try {
    const raw = await readCertificateVaultPayload(row.vaultRef);
    const envelope = parseCertificateVaultEnvelope(raw);
    return { ok: true, data: { envelope } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler cofre de certificado.";
    return { ok: false, error: { status: 500, message: msg } };
  }
}

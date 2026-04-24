import { randomUUID } from "node:crypto";

/** Armazenamento in-memory para testes / dev — nunca usar em produção. */
const mockStore = new Map<string, Buffer>();

export function clearCertUploadVaultMockForTests(): void {
  mockStore.clear();
}

export function getCertUploadVaultDriver(): "mock" {
  const d = process.env.CERT_UPLOAD_VAULT_DRIVER?.trim().toLowerCase();
  if (d && d !== "mock") {
    throw new Error(`CERT_UPLOAD_VAULT_DRIVER=${d} não suportado neste build.`);
  }
  return "mock";
}

export async function writeCertificateToVault(input: {
  organizationId: string;
  companyId: string;
  bytes: Buffer;
}): Promise<{ vaultRef: string }> {
  getCertUploadVaultDriver();
  const vaultRef = `mock:${randomUUID()}`;
  mockStore.set(vaultRef, Buffer.from(input.bytes));
  return { vaultRef };
}

export async function deleteCertificateVaultObject(vaultRef: string): Promise<void> {
  mockStore.delete(vaultRef);
}

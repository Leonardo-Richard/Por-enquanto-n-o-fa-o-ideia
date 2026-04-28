import { randomUUID } from "node:crypto";
import { getAdnSupabaseServiceClient } from "@/lib/adn-supabase-server";

/** Armazenamento in-memory apenas para testes automatizados. */
const mockStore = new Map<string, Buffer>();

type CertUploadVaultDriver = "mock" | "supabase-storage";

export function clearCertUploadVaultMockForTests(): void {
  mockStore.clear();
}

function certUploadVaultBucket(): string {
  return process.env.CERT_UPLOAD_VAULT_BUCKET?.trim() || "adn-certificates";
}

function buildSupabaseObjectPath(organizationId: string, companyId: string): string {
  const version = `${Date.now()}-${randomUUID()}`;
  return `adn-cert/${organizationId}/${companyId}/${version}.p12`;
}

function buildSupabaseVaultRef(bucket: string, objectPath: string): string {
  return `supabase-storage:${bucket}:${objectPath}`;
}

function parseSupabaseVaultRef(vaultRef: string): { bucket: string; objectPath: string } | null {
  const prefix = "supabase-storage:";
  if (!vaultRef.startsWith(prefix)) return null;
  const rest = vaultRef.slice(prefix.length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep >= rest.length - 1) return null;
  return {
    bucket: rest.slice(0, sep),
    objectPath: rest.slice(sep + 1),
  };
}

export function getCertUploadVaultDriver(): CertUploadVaultDriver {
  const d = process.env.CERT_UPLOAD_VAULT_DRIVER?.trim().toLowerCase();
  if (!d) {
    return process.env.NODE_ENV === "test" ? "mock" : "supabase-storage";
  }
  if (d === "supabase" || d === "supabase-storage") {
    return "supabase-storage";
  }
  if (d === "mock") {
    // Defesa em profundidade: em runtime real, nunca manter segredos no mock em memória.
    if (process.env.NODE_ENV !== "test") {
      return "supabase-storage";
    }
    return "mock";
  }
  if (d !== "mock") {
    throw new Error(`CERT_UPLOAD_VAULT_DRIVER=${d} não suportado neste build.`);
  }
  return "mock";
}

export async function writeCertificateToVault(input: {
  organizationId: string;
  companyId: string;
  bytes: Buffer;
}): Promise<{ vaultRef: string }> {
  const driver = getCertUploadVaultDriver();
  if (driver === "mock") {
    const vaultRef = `mock:${randomUUID()}`;
    mockStore.set(vaultRef, Buffer.from(input.bytes));
    return { vaultRef };
  }

  const supabase = getAdnSupabaseServiceClient();
  const bucket = certUploadVaultBucket();
  const objectPath = buildSupabaseObjectPath(input.organizationId, input.companyId);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, input.bytes, {
      upsert: false,
      contentType: "application/x-pkcs12",
      cacheControl: "0",
    });
  if (error) {
    throw new Error(error.message || "Falha ao gravar certificado no Supabase Storage.");
  }
  return { vaultRef: buildSupabaseVaultRef(bucket, objectPath) };
}

export async function deleteCertificateVaultObject(vaultRef: string): Promise<void> {
  const driver = getCertUploadVaultDriver();
  if (vaultRef.startsWith("mock:")) {
    mockStore.delete(vaultRef);
    return;
  }
  const parsed = parseSupabaseVaultRef(vaultRef);
  if (!parsed) return;

  // Permite limpar refs legadas de Supabase mesmo quando driver actual estiver em mock (testes).
  if (driver === "mock" && process.env.NODE_ENV === "test") return;

  const supabase = getAdnSupabaseServiceClient();
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.objectPath]);
  if (error) {
    throw new Error(error.message || "Falha ao remover certificado do Supabase Storage.");
  }
}

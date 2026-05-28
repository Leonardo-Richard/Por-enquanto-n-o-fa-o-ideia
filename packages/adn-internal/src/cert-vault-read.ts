import { createClient } from "@supabase/supabase-js";

/** Armazenamento in-memory apenas para testes automatizados (partilhado com escrita em runtime test). */
export const certVaultMockStore = new Map<string, Buffer>();

export function clearCertVaultMockForTests(): void {
  certVaultMockStore.clear();
}

export type CertificateVaultEnvelopeV1 = {
  version: 1;
  format: "pkcs12";
  pkcs12Base64: string;
  password: string;
};

function certUploadVaultBucket(): string {
  return process.env.CERT_UPLOAD_VAULT_BUCKET?.trim() || "adn-certificates";
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

function vaultDriver(): "mock" | "supabase-storage" {
  const d = process.env.CERT_UPLOAD_VAULT_DRIVER?.trim().toLowerCase();
  if (!d) {
    return process.env.NODE_ENV === "test" ? "mock" : "supabase-storage";
  }
  if (d === "mock") {
    return process.env.NODE_ENV === "test" ? "mock" : "supabase-storage";
  }
  return "supabase-storage";
}

export async function readCertificateVaultPayload(vaultRef: string): Promise<Buffer> {
  if (vaultRef.startsWith("mock:")) {
    const buf = certVaultMockStore.get(vaultRef);
    if (!buf) {
      throw new Error("Certificado mock não encontrado no cofre de testes.");
    }
    return buf;
  }

  const parsed = parseSupabaseVaultRef(vaultRef);
  if (!parsed) {
    throw new Error("vault_ref não suportado para leitura no servidor.");
  }

  const driver = vaultDriver();
  if (driver === "mock" && process.env.NODE_ENV === "test") {
    throw new Error("Cofre em modo mock sem objecto para esta vault_ref.");
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Leitura do cofre: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.objectPath);
  if (error || !data) {
    throw new Error(error?.message || "Falha ao descarregar certificado do Storage.");
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

export function parseCertificateVaultEnvelope(raw: Buffer): CertificateVaultEnvelopeV1 {
  let json: unknown;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("Envelope de certificado inválido (JSON).");
  }
  if (
    typeof json !== "object" ||
    json === null ||
    (json as CertificateVaultEnvelopeV1).version !== 1 ||
    (json as CertificateVaultEnvelopeV1).format !== "pkcs12"
  ) {
    throw new Error("Envelope de certificado inválido (versão/formato).");
  }
  const env = json as CertificateVaultEnvelopeV1;
  if (!env.pkcs12Base64 || !env.password) {
    throw new Error("Envelope de certificado inválido: campos obrigatórios em falta.");
  }
  return env;
}

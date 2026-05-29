import { getAdnSupabaseServiceClient } from "./adn-supabase-server";

export type AdnArtifactKind = "xml" | "pdf";

export function adnStorageBucket(): string {
  return process.env["ADN_STORAGE_BUCKET"]?.trim() || "adn-artifacts";
}

/** Path canónico ADN (FR44 / arquitectura §4.1). */
export function canonicalAdnObjectPath(
  organizationId: string,
  companyId: string,
  accessKey: string,
  kind: AdnArtifactKind,
): string {
  const ext = kind === "xml" ? "xml" : "pdf";
  return `org/${organizationId}/company/${companyId}/${accessKey}/${kind}.${ext}`;
}

export function adnDownloadUrlTtlSeconds(): number {
  const raw = process.env["ADN_DOWNLOAD_URL_TTL_SECONDS"];
  const n = raw ? Number.parseInt(raw, 10) : 90;
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export function adnWorkerUploadUrlTtlSeconds(): number {
  const raw = process.env["ADN_WORKER_UPLOAD_URL_TTL_SECONDS"];
  const n = raw ? Number.parseInt(raw, 10) : 900;
  return Number.isFinite(n) && n > 0 && n <= 900 ? n : 900;
}

export async function createAdnPresignedPutUrl(objectPath: string): Promise<{
  signedUrl: string;
  expiresAt: string;
  expiresIn: number;
}> {
  const supabase = getAdnSupabaseServiceClient();
  const bucket = adnStorageBucket();
  const expiresIn = adnWorkerUploadUrlTtlSeconds();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Falha ao criar URL de upload ADN.");
  }
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return { signedUrl: data.signedUrl, expiresAt, expiresIn };
}

export async function createAdnPresignedGetUrl(objectPath: string): Promise<{
  signedUrl: string;
  expiresAt: string;
  expiresIn: number;
}> {
  const supabase = getAdnSupabaseServiceClient();
  const bucket = adnStorageBucket();
  const expiresIn = adnDownloadUrlTtlSeconds();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Falha ao criar URL de download ADN.");
  }
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return { signedUrl: data.signedUrl, expiresAt, expiresIn };
}

/** Download de bytes via service role (bulk ZIP no servidor). */
export async function downloadAdnObjectBytes(objectPath: string): Promise<Uint8Array> {
  const supabase = getAdnSupabaseServiceClient();
  const bucket = adnStorageBucket();
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao obter ficheiro ADN do storage.");
  }
  const buf = await data.arrayBuffer();
  return new Uint8Array(buf);
}

export function adnPdfsZipMaxCount(): number {
  const raw = process.env["ADN_PDFS_ZIP_MAX_COUNT"];
  const n = raw ? Number.parseInt(raw, 10) : 200;
  return Number.isFinite(n) && n > 0 ? n : 200;
}

export function adnCommitVerifyStorageSha256(): boolean {
  const raw = process.env["ADN_COMMIT_VERIFY_STORAGE_SHA256"]?.trim().toLowerCase();
  return raw !== "false" && raw !== "0";
}

export function adnPdfsZipMaxTotalBytes(): number {
  const raw = process.env["ADN_PDFS_ZIP_MAX_TOTAL_BYTES"];
  const n = raw ? Number.parseInt(raw, 10) : 150 * 1024 * 1024;
  return Number.isFinite(n) && n > 0 ? n : 150 * 1024 * 1024;
}

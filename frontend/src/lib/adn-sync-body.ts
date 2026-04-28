import { createHash } from "node:crypto";
import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/** Corpo *strict* POST .../sync (story ADN-04 Dev Notes). */
export const adnPostSyncBodySchema = z
  .object({
    fetchMode: z.enum(["incremental", "all"]).optional(),
    issuedFrom: z
      .string()
      .trim()
      .regex(dateRe, "issuedFrom deve ser YYYY-MM-DD.")
      .optional(),
    issuedTo: z
      .string()
      .trim()
      .regex(dateRe, "issuedTo deve ser YYYY-MM-DD.")
      .optional(),
  })
  .strict();

export type AdnPostSyncBody = z.infer<typeof adnPostSyncBodySchema>;

/** Objecto canónico para *fingerprint* (chaves ordenadas, trim nos valores). */
export function canonicalSyncBodyForFingerprint(body: AdnPostSyncBody): Record<string, string> {
  const out: Record<string, string> = {};
  if (body.fetchMode) {
    out.fetchMode = body.fetchMode;
  }
  if (body.issuedFrom) {
    out.issuedFrom = body.issuedFrom.trim();
  }
  if (body.issuedTo) {
    out.issuedTo = body.issuedTo.trim();
  }
  return out;
}

export function fingerprintFromCanonical(canonical: Record<string, string>): string {
  const keys = Object.keys(canonical).sort();
  const inner = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(canonical[k])}`).join(",");
  const payload = `{${inner}}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

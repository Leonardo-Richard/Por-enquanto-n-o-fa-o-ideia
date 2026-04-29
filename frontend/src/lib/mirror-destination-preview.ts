/**
 * Alinhado a `mirror_local.sanitize_system_code` + destino `{root}/{code} - {cnpj}/`.
 */

export function sanitizeSystemCodeForMirrorPath(raw: string): string {
  const replaced = raw.replace(/[<>:"|?*\\/\u0000-\u001F]/g, "_").trim();
  const compact = replaced.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const base = compact || "system";
  return base.length > 80 ? base.slice(0, 80) : base;
}

/** Nome da pasta criada pelo worker dentro da raiz. */
export function mirrorDestinationFolderName(systemCode: string, cnpjDigits: string): string {
  return `${sanitizeSystemCodeForMirrorPath(systemCode)} - ${cnpjDigits}`;
}

/** Caminho completo previsto (uma pasta, sem barra final). */
export function mirrorDestinationPathPreview(
  localDownloadRoot: string,
  systemCode: string,
  cnpjDigits: string,
): string {
  const root = localDownloadRoot.trim().replace(/[/\\]+$/, "");
  const sub = mirrorDestinationFolderName(systemCode, cnpjDigits);
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root}${sep}${sub}`;
}

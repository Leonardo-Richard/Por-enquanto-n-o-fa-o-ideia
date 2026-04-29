/**
 * Alinhado a `mirror_local.dominio_mirror_folder_name`: pasta «Código-Apelido»
 * (Domínio Web — rotinas automáticas), sem espaços em volta do hífen.
 */

const INVALID_FS = /[<>:"|?*\\/\u0000-\u001F]/g;

function collapseUnderscores(s: string): string {
  return s.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

/** Segmento «código»: hífens viram «_» para o único «-» da pasta ser o separador código–apelido. */
export function sanitizeDominioCodigoForMirrorPath(raw: string): string {
  const replaced = raw.replace(INVALID_FS, "_").trim().replace(/-/g, "_");
  const compact = collapseUnderscores(replaced);
  const base = compact || "0";
  return base.length > 80 ? base.slice(0, 80) : base;
}

/** Apelido / nome fantasia: espaços internos permitidos; hífens → «_». */
export function sanitizeDominioApelidoForMirrorPath(raw: string): string {
  const replaced = raw.replace(INVALID_FS, "_").trim().replace(/-/g, "_");
  const spaced = replaced.replace(/\s+/g, " ").trim().replace(/[.\s]+$/g, "");
  const base = spaced || "EMPRESA";
  return base.length > 120 ? base.slice(0, 120) : base;
}

/** Nome da pasta criada pelo worker dentro da raiz (padrão Domínio). */
export function mirrorDestinationFolderName(
  systemCode: string,
  tradeName: string,
  cnpjDigits: string,
): string {
  const codigo = sanitizeDominioCodigoForMirrorPath(systemCode);
  const apelidoRaw = tradeName.trim();
  const apelido = apelidoRaw
    ? sanitizeDominioApelidoForMirrorPath(apelidoRaw)
    : sanitizeDominioApelidoForMirrorPath(cnpjDigits);
  return `${codigo}-${apelido}`;
}

/** Caminho completo previsto (uma pasta, sem barra final). */
export function mirrorDestinationPathPreview(
  localDownloadRoot: string,
  systemCode: string,
  tradeName: string,
  cnpjDigits: string,
): string {
  const root = localDownloadRoot.trim().replace(/[/\\]+$/, "");
  const sub = mirrorDestinationFolderName(systemCode, tradeName, cnpjDigits);
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root}${sep}${sub}`;
}

/** @deprecated Use `sanitizeDominioCodigoForMirrorPath` — mantido para imports legados. */
export function sanitizeSystemCodeForMirrorPath(raw: string): string {
  return sanitizeDominioCodigoForMirrorPath(raw);
}

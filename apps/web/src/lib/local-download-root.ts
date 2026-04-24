/** NFR30 — validação de `local_download_root` / `localDownloadRoot` (arquitectura LM §5). */
export const MAX_LOCAL_DOWNLOAD_ROOT_LENGTH = 512;

const CTRL_RE = /[\u0000-\u001F\u007F]/;

export type LocalPathErrorCode =
  | "LOCAL_PATH_TOO_LONG"
  | "LOCAL_PATH_INVALID_CHARS"
  | "LOCAL_PATH_TRAVERSAL"
  | "LOCAL_PATH_INVALID";

export function normalizeLocalDownloadRootInput(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

export function validateLocalDownloadRoot(
  raw: string | null,
): { ok: true; value: string | null } | { ok: false; code: LocalPathErrorCode; message: string } {
  const value = normalizeLocalDownloadRootInput(raw);
  if (value === null) {
    return { ok: true, value: null };
  }
  if (value.length > MAX_LOCAL_DOWNLOAD_ROOT_LENGTH) {
    return {
      ok: false,
      code: "LOCAL_PATH_TOO_LONG",
      message: `O caminho excede ${MAX_LOCAL_DOWNLOAD_ROOT_LENGTH} caracteres.`,
    };
  }
  if (CTRL_RE.test(value)) {
    return {
      ok: false,
      code: "LOCAL_PATH_INVALID_CHARS",
      message: "O caminho contém caracteres de controlo não permitidos.",
    };
  }
  // Extended-length / device paths — antes do teste genérico `\\` (UNC vs \\?\).
  const low = value.toLowerCase();
  if (low.startsWith("\\\\?\\") || low.startsWith("\\\\.\\")) {
    return {
      ok: false,
      code: "LOCAL_PATH_TRAVERSAL",
      message:
        "Prefixos «\\\\?\\» ou «\\\\.\\» (extended path / device) não são suportados. Use um caminho normal (ex.: C:\\Pastas).",
    };
  }
  if (value.startsWith("\\\\")) {
    return {
      ok: false,
      code: "LOCAL_PATH_TRAVERSAL",
      message: "Caminhos UNC (\\\\servidor\\…) não são suportados nesta versão.",
    };
  }
  const segments = value.split(/[/\\]+/).filter((s) => s.length > 0);
  if (segments.some((s) => s === "..")) {
    return {
      ok: false,
      code: "LOCAL_PATH_TRAVERSAL",
      message: "O caminho não pode conter segmentos «..».",
    };
  }
  // Caracteres reservados em nomes de ficheiro Windows (NFR30 / arquitectura §4.2 — LOCAL_PATH_INVALID).
  if (/[<>"|?*]/.test(value)) {
    return {
      ok: false,
      code: "LOCAL_PATH_INVALID",
      message: "O caminho contém símbolos não permitidos no Windows («< > \" | ? *»).",
    };
  }
  return { ok: true, value };
}

export function auditSuffixPreview(path: string, maxLen = 24): string {
  if (path.length <= maxLen) {
    return path;
  }
  return `…${path.slice(-maxLen)}`;
}

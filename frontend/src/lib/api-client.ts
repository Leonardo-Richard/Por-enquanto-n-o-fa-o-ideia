const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export function apiUrl(path: string): string {
  if (!PUBLIC_API_BASE) {
    return path;
  }
  const base = PUBLIC_API_BASE.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

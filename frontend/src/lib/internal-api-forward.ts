import { NextResponse } from "next/server";

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveInternalApiBaseUrl(): string | null {
  const apiInternal = process.env.API_INTERNAL_URL?.trim();
  if (apiInternal) return normalizeBase(apiInternal);
  const apiBase = process.env.API_BASE_URL?.trim();
  if (apiBase) return normalizeBase(apiBase);
  return null;
}

export async function maybeForwardInternalApi(request: Request): Promise<NextResponse | null> {
  const base = resolveInternalApiBaseUrl();
  if (!base) return null;

  const src = new URL(request.url);
  const dst = `${base}${src.pathname}${src.search}`;
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    redirect: "manual",
    cache: "no-store",
  };
  const proxied = await fetch(dst, init);
  const text = await proxied.text();
  return new NextResponse(text, {
    status: proxied.status,
    headers: proxied.headers,
  });
}

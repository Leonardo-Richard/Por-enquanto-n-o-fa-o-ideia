/** Extrai mensagem legível de respostas JSON da API (NextResponse/jsonError ou Better Auth). */

export function messageFromApiJson(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const o = body as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.length > 0) {
    return o.message;
  }
  if (typeof o.error === "string" && o.error.length > 0) {
    return o.error;
  }
  const err = o.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.length > 0) {
      return e.message;
    }
  }
  return undefined;
}

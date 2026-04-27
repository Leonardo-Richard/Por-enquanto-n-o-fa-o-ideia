import { NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      message,
      ...(extra ? { error: extra } : {}),
    },
    { status },
  );
}

export function toPublicApiError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message === "DATABASE_URL não definido" || error.message.includes("DATABASE_URL")) {
      return jsonError(
        503,
        "Serviço temporariamente indisponível: configuração da base de dados em falta.",
      );
    }
    if (!isProd) return jsonError(500, error.message);
  }
  return jsonError(500, "Erro interno do servidor.");
}

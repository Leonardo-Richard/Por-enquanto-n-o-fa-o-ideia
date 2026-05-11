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
  // SEMPRE loga o erro real no console do servidor — em produção a resposta
  // ao cliente é mascarada por motivos de segurança, mas o operador precisa
  // ver a stack/mensagem real nos logs do EasyPanel/Vercel para diagnosticar.
  try {
    if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(
        "[toPublicApiError]",
        error.name,
        error.message,
        "\nstack:",
        error.stack,
      );
    } else {
      // eslint-disable-next-line no-console
      console.error("[toPublicApiError] (non-Error)", error);
    }
  } catch {
    // best-effort: nunca deixar o logger esconder o erro original.
  }
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

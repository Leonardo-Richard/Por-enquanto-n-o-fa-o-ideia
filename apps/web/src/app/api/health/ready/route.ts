import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return h.slice(7).trim();
}

function sha256Utf8(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Comparação sem fuga de comprimento do segredo (sempre `timingSafeEqual` em digest de 32 B). */
function bearerSecretMatches(token: string | null, secret: string): boolean {
  const a = sha256Utf8(token ?? "");
  const b = sha256Utf8(secret);
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const READY_TIMEOUT_MS = 2500;

/** Readiness com verificação leve à DB; exige `Authorization: Bearer <READINESS_SECRET>`. */
export async function GET(request: Request) {
  const secret = process.env.READINESS_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        message:
          "Readiness desativado: defina a variável READINESS_SECRET no ambiente de deploy para ativar este endpoint.",
        disabled: true,
      },
      { status: 503 },
    );
  }

  const token = bearerToken(request);
  if (!bearerSecretMatches(token, secret)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  try {
    const db = getDb();
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("readiness_timeout")), READY_TIMEOUT_MS);
      }),
    ]);
    return NextResponse.json({ status: "ok" as const });
  } catch {
    return NextResponse.json({ status: "degraded" as const });
  }
}

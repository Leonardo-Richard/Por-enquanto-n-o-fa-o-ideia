import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { parseDatabaseUrlForDiagnostics, resolveDatabaseUrlFromEnv } from "@repo/db/portal-db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

function sha256Utf8(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function bearerSecretMatches(token: string | null, secret: string): boolean {
  const a = sha256Utf8(token ?? "");
  const b = sha256Utf8(secret);
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Diagnóstico de ligação Postgres (host/user/fonte). Requer `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ message: "CRON_SECRET não definido." }, { status: 503 });
  }
  if (!bearerSecretMatches(bearerToken(request), secret)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const resolved = resolveDatabaseUrlFromEnv(process.env);
  if (!resolved) {
    return NextResponse.json(
      {
        status: "misconfigured" as const,
        message:
          "Defina PORTAL_DATABASE_URL, DATABASE_URL ou SUPABASE_DB_PASSWORD + SUPABASE_DB_HOST (+ NEXT_PUBLIC_SUPABASE_URL).",
      },
      { status: 503 },
    );
  }

  const connection = parseDatabaseUrlForDiagnostics(resolved.url);
  try {
    const db = getDb();
    await db.execute(sql`select 1 as ok`);
    return NextResponse.json({
      status: "ok" as const,
      source: resolved.source,
      connection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "auth_failed" as const,
        source: resolved.source,
        connection,
        error: message.slice(0, 200),
      },
      { status: 503 },
    );
  }
}

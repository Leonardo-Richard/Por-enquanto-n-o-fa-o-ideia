import { NextResponse } from "next/server";
import type { ZodError } from "zod";

const isProdLike =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

export function adnJsonFromZodError(
  status: number,
  message: string,
  errorCode: string,
  err: ZodError,
): NextResponse {
  const body: Record<string, unknown> = { message, error_code: errorCode };
  if (!isProdLike) {
    body.details = err.flatten();
  }
  return NextResponse.json(body, { status });
}

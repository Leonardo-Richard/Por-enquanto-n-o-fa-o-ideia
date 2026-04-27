import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function adnJsonFromZodError(
  status: number,
  message: string,
  errorCode: string,
  err: ZodError,
): NextResponse {
  void err;
  return NextResponse.json({ message, error_code: errorCode }, { status });
}

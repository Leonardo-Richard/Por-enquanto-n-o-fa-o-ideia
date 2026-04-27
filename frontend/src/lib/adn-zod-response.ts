import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function adnJsonFromZodError(
  status: number,
  message: string,
  errorCode: string,
  err: ZodError,
): NextResponse {
  void err;
  /** Resposta ADN pública: só `message` + `error_code` (sem `details` Zod — CER-05 / revisão QA). */
  return NextResponse.json({ message, error_code: errorCode }, { status });
}

import { NextResponse } from "next/server";

export function adnJsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ message }, { status });
}

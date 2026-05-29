import { NextResponse } from "next/server";
import type { AdnHandlerResult } from "@repo/adn-internal";

export function adnHandlerToResponse<T>(result: AdnHandlerResult<T>): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  const { status, message, error_code, extra } = result.error;
  return NextResponse.json(
    {
      message,
      ...(error_code ? { error_code } : {}),
      ...extra,
    },
    { status },
  );
}

import { APP_SLUG } from "@repo/shared";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok" as const, app: `${APP_SLUG}-api` });
}

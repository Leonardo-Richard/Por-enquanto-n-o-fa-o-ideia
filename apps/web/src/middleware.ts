import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitLogin } from "@/lib/rate-limit";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/registo",
  "/recuperar",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/api/auth/sign-in/email" &&
    request.method === "POST"
  ) {
    const xf = request.headers.get("x-forwarded-for");
    const ip = xf?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
    const rl = await rateLimitLogin(ip);
    if (!rl.ok) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Demasiadas tentativas de login." } },
        { status: 429 },
      );
    }
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const next = `${pathname}${request.nextUrl.search}`;
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

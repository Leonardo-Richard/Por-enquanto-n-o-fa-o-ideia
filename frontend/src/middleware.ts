import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const res = NextResponse.next();
    const pathWithSearch = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    res.headers.set("x-admin-pathname", pathWithSearch);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DASHBOARD_PREFIXES = [
  "/dashboard",
  "/empresas",
  "/empresas-monitoradas",
  "/configuracoes",
  "/execucoes",
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin")) {
    const res = NextResponse.next();
    const pathWithSearch = `${pathname}${request.nextUrl.search}`;
    res.headers.set("x-admin-pathname", pathWithSearch);
    return res;
  }

  if (DASHBOARD_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const res = NextResponse.next();
    const pathWithSearch = `${pathname}${request.nextUrl.search}`;
    res.headers.set("x-dashboard-pathname", pathWithSearch);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/empresas",
    "/empresas/:path*",
    "/empresas-monitoradas",
    "/empresas-monitoradas/:path*",
    "/configuracoes",
    "/configuracoes/:path*",
    "/execucoes",
    "/execucoes/:path*",
  ],
};

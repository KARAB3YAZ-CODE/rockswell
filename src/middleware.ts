import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_PATH_PREFIX, ADMIN_URL, isAdminHost } from "@/lib/admin-host"

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")
  const { pathname, search } = request.nextUrl

  // Main site: /admin → admin subdomain
  if (!isAdminHost(host) && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const dest = new URL(pathname.replace(/^\/admin\/?/, "/") || "/", ADMIN_URL)
    dest.search = search
    return NextResponse.redirect(dest, 308)
  }

  // Admin host: rewrite bare paths → /admin-app/*
  if (isAdminHost(host)) {
    // Already under /admin-app — pass through
    if (pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`)) {
      return NextResponse.next()
    }

    // Allow Next internals & API (admin API routes stay on same deployment)
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/favicon") ||
      pathname.includes(".")
    ) {
      return NextResponse.next()
    }

    const url = request.nextUrl.clone()
    url.pathname = pathname === "/" ? ADMIN_PATH_PREFIX : `${ADMIN_PATH_PREFIX}${pathname}`
    return NextResponse.rewrite(url)
  }

  // Store host: block direct /admin-app browsing (send to admin subdomain)
  if (pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`)) {
    const rest = pathname.slice(ADMIN_PATH_PREFIX.length) || "/"
    const dest = new URL(rest, ADMIN_URL)
    dest.search = search
    return NextResponse.redirect(dest, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

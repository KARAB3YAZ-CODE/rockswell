/** Admin subdomain / URL helpers */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rockswell.store").replace(/\/$/, "")
export const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.rockswell.store").replace(/\/$/, "")

const ADMIN_HOSTS = new Set([
  "admin.rockswell.store",
  "admin.localhost",
  "admin.localhost:3000",
])

export function isAdminHost(host: string | null | undefined): boolean {
  if (!host) return false
  const h = host.toLowerCase().split(":")[0]
  if (h === "admin.rockswell.store" || h === "admin.localhost") return true
  // Allow explicit env host
  try {
    const adminHost = new URL(ADMIN_URL).hostname
    if (h === adminHost) return true
  } catch {
    /* ignore */
  }
  return ADMIN_HOSTS.has(host.toLowerCase())
}

/** Public path prefix used internally for the admin app (rewritten on subdomain). */
export const ADMIN_PATH_PREFIX = "/admin-app"

export function adminPath(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`
  if (p === "/") return ADMIN_PATH_PREFIX
  return `${ADMIN_PATH_PREFIX}${p}`
}

/** Absolute admin URL for links from the storefront. */
export function adminAbsoluteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`
  return `${ADMIN_URL}${p === "/" ? "" : p}`
}

export function siteAbsoluteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`
  return `${SITE_URL}${p === "/" ? "" : p}`
}

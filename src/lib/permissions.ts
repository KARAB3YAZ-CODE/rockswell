import type { User, UserRole } from "./types"

export function canPlaceOrder(user: User | null | undefined): boolean {
  if (!user) return false
  return ["company_admin", "purchase_manager", "admin"].includes(user.role)
}

export function canApproveOrder(user: User | null | undefined): boolean {
  if (!user) return false
  return user.role === "company_admin" || user.role === "admin"
}

export function canViewInvoices(user: User | null | undefined): boolean {
  if (!user) return false
  return ["company_admin", "finance_user", "admin", "purchase_manager"].includes(user.role)
}

export function canViewCredit(user: User | null | undefined): boolean {
  if (!user) return false
  return ["company_admin", "finance_user", "admin"].includes(user.role)
}

export function canManageUsers(user: User | null | undefined): boolean {
  if (!user) return false
  return user.role === "company_admin" || user.role === "admin"
}

export function canViewOrders(user: User | null | undefined): boolean {
  if (!user) return false
  return user.role !== "sales_manager" // all dealer roles except pure sales can view; sales_manager also ok actually
}

/** Nav hrefs allowed for role */
export function allowedNavHrefs(role: UserRole | string): string[] | "all" {
  switch (role) {
    case "admin":
      return "all"
    case "company_admin":
      return "all"
    case "purchase_manager":
      return [
        "/home",
        "/products",
        "/orders",
        "/cart",
        "/account/campaigns",
        "/account/support",
        "/account/settings",
        "/account/help",
        "/account/reports",
      ]
    case "finance_user":
      return [
        "/home",
        "/orders",
        "/account/invoices",
        "/account/credit",
        "/account/reports",
        "/account/support",
        "/account/settings",
        "/account/help",
      ]
    case "warehouse_user":
      return [
        "/home",
        "/orders",
        "/products",
        "/account/support",
        "/account/settings",
        "/account/help",
      ]
    case "sales_manager":
      return [
        "/home",
        "/products",
        "/orders",
        "/account/campaigns",
        "/account/support",
        "/account/settings",
        "/account/help",
      ]
    default:
      return ["/home", "/account/settings", "/account/help"]
  }
}

export function canAccessPath(user: User | null | undefined, pathname: string): boolean {
  if (!user) return false
  if (user.role === "admin" || user.role === "company_admin") return true
  const allowed = allowedNavHrefs(user.role)
  if (allowed === "all") return true
  return allowed.some((href) => pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`))
}

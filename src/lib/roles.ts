import type { UserRole } from "./types"

export const ROLE_LABELS: Record<UserRole | string, string> = {
  admin: "Yönetici",
  purchase_manager: "Satın Alma Yöneticisi",
  sales_manager: "Satış Yöneticisi",
  warehouse_user: "Depo Kullanıcısı",
  finance_user: "Finans Kullanıcısı",
  company_admin: "Firma Yöneticisi",
}

export function roleLabel(role?: string | null): string {
  if (!role) return "Kullanıcı"
  return ROLE_LABELS[role] ?? role
}

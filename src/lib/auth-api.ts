import { getServiceClient } from "@/lib/supabase-admin"
import type { SupabaseClient } from "@supabase/supabase-js"

export type BearerAuthResult =
  | {
      ok: true
      service: SupabaseClient
      userId: string
      email: string | undefined
      role: string
      companyId: string | null
    }
  | { ok: false; error: string; status: 401 | 403 }

/** Verifies Bearer token and loads profile. Server-only. */
export async function requireBearerUser(request: Request): Promise<BearerAuthResult> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return { ok: false, error: "Yetkilendirme gerekli", status: 401 }

  const service = getServiceClient()
  const { data: auth, error } = await service.auth.getUser(token)
  if (error || !auth.user) return { ok: false, error: "Oturum geçersiz", status: 401 }

  const { data: profile } = await service
    .from("profiles")
    .select("role, company_id, is_active")
    .eq("id", auth.user.id)
    .maybeSingle()

  if (!profile || profile.is_active === false) {
    return { ok: false, error: "Hesap aktif değil", status: 403 }
  }

  return {
    ok: true,
    service,
    userId: auth.user.id,
    email: auth.user.email,
    role: String(profile.role ?? ""),
    companyId: profile.company_id ? String(profile.company_id) : null,
  }
}

/** True when caller owns the order (same company / own user) or is admin. */
export function canAccessOrder(
  auth: Extract<BearerAuthResult, { ok: true }>,
  order: { company_id?: string | null; user_id?: string | null }
): boolean {
  if (auth.role === "admin") return true
  if (auth.companyId && order.company_id && String(order.company_id) === auth.companyId) {
    return true
  }
  if (order.user_id && String(order.user_id) === auth.userId) return true
  return false
}

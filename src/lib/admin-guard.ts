import { getServiceClient } from "@/lib/supabase-admin"
import type { SupabaseClient } from "@supabase/supabase-js"

type GuardResult =
  | { ok: true; service: SupabaseClient; callerId: string }
  | { ok: false; error: string; status: 401 | 403 }

/** Verifies the request bearer token belongs to an admin. Server-only. */
export async function requireAdmin(request: Request): Promise<GuardResult> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return { ok: false, error: "Yetkilendirme gerekli", status: 401 }

  const service = getServiceClient()
  const { data: caller, error } = await service.auth.getUser(token)
  if (error || !caller.user) return { ok: false, error: "Oturum geçersiz", status: 401 }

  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", caller.user.id)
    .single()
  if (profile?.role !== "admin") {
    return { ok: false, error: "Bu işlem için yönetici olmalısınız", status: 403 }
  }

  return { ok: true, service, callerId: caller.user.id }
}

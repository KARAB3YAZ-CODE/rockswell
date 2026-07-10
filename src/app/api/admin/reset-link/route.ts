import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-admin"

/**
 * Admin-only. Generates a fresh password-recovery link for a target user.
 * The admin copies this link and sends it to the member manually. No email is sent.
 */
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    if (!token) return NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 })

    const service = getServiceClient()

    // Verify caller identity + admin role.
    const { data: caller, error: callerErr } = await service.auth.getUser(token)
    if (callerErr || !caller.user) {
      return NextResponse.json({ error: "Oturum geçersiz" }, { status: 401 })
    }
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .single()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Bu işlem için yönetici olmalısınız" }, { status: 403 })
    }

    const { userId, email: emailFromBody } = await request.json()

    let email = emailFromBody as string | undefined
    if (!email && userId) {
      const { data: target, error: targetErr } = await service.auth.admin.getUserById(userId)
      if (targetErr || !target.user?.email) {
        return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
      }
      email = target.user.email
    }
    if (!email) return NextResponse.json({ error: "E-posta veya kullanıcı gerekli" }, { status: 400 })

    // Always point recovery links at production so links never resolve to
    // localhost (e.g. when generated from a dev environment).
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://rockswell.store").replace(/\/$/, "")
    const redirectTo = `${origin}/reset-password`

    const { data, error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    })
    if (error || !data.properties?.action_link) {
      return NextResponse.json({ error: error?.message ?? "Link oluşturulamadı" }, { status: 400 })
    }

    return NextResponse.json({ email, link: data.properties.action_link })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Link oluşturulamadı"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

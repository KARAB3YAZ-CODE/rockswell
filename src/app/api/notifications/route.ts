import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-admin"

/**
 * Inserts a notification via service role (bypasses RLS).
 * Caller must be authenticated; may notify self, or any user if admin.
 */
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    if (!token) {
      return NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 })
    }

    const service = getServiceClient()
    const { data: auth, error: authErr } = await service.auth.getUser(token)
    if (authErr || !auth.user) {
      return NextResponse.json({ error: "Oturum geçersiz" }, { status: 401 })
    }

    const body = await request.json()
    const userId = String(body.userId ?? "")
    const title = String(body.title ?? "").trim()
    const message = String(body.message ?? "").trim()
    const type = ["info", "success", "warning", "error"].includes(body.type) ? body.type : "info"
    const link = body.link ? String(body.link) : null

    if (!userId || !title || !message) {
      return NextResponse.json({ error: "userId, title ve message gerekli" }, { status: 400 })
    }

    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle()

    const isAdmin = profile?.role === "admin"
    if (!isAdmin && userId !== auth.user.id) {
      return NextResponse.json({ error: "Başkasına bildirim gönderemezsiniz" }, { status: 403 })
    }

    const { error } = await service.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      link,
      is_read: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bildirim oluşturulamadı" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-admin"
import { sendMail, orderStatusMailHtml } from "@/lib/email"

/**
 * Sends transactional email for order events.
 * Auth: Bearer of caller (admin or order owner).
 * Requires RESEND_API_KEY (or logs in dev).
 */
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    if (!token) return NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 })

    const service = getServiceClient()
    const { data: auth } = await service.auth.getUser(token)
    if (!auth.user) return NextResponse.json({ error: "Oturum geçersiz" }, { status: 401 })

    const body = await request.json()
    const orderId = String(body.orderId ?? "")
    const title = String(body.title ?? "").trim()
    const message = String(body.message ?? "").trim()
    const link = body.link ? String(body.link) : undefined

    if (!orderId || !title) {
      return NextResponse.json({ error: "orderId ve title gerekli" }, { status: 400 })
    }

    const { data: order } = await service
      .from("orders")
      .select("id, order_number, user_id, company_id")
      .eq("id", orderId)
      .maybeSingle()

    if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 })

    const { data: profile } = await service
      .from("profiles")
      .select("role, email, company_id")
      .eq("id", auth.user.id)
      .maybeSingle()

    const isAdmin = profile?.role === "admin"
    const isOwner = order.user_id === auth.user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 })
    }

    const { data: target } = await service
      .from("profiles")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle()

    const to = target?.email || auth.user.email
    if (!to) return NextResponse.json({ error: "Alıcı e-posta yok" }, { status: 400 })

    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.rockswell.store").replace(/\/$/, "")
    const absoluteLink = link?.startsWith("http") ? link : link ? `${site}${link}` : undefined

    const ok = await sendMail({
      to,
      subject: `${title} · ${order.order_number}`,
      html: orderStatusMailHtml({
        orderNumber: String(order.order_number),
        title,
        message: message || title,
        link: absoluteLink,
      }),
      text: `${title}\n${order.order_number}\n${message}`,
    })

    return NextResponse.json({ ok, mailed: ok })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mail gönderilemedi" },
      { status: 500 }
    )
  }
}

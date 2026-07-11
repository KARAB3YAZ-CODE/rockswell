import { NextResponse } from "next/server"
import { requireBearerUser, canAccessOrder } from "@/lib/auth-api"

/** Signed URL for viewing a havale receipt (owner/company or admin). */
export async function GET(request: Request) {
  const auth = await requireBearerUser(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const orderId = new URL(request.url).searchParams.get("orderId") ?? ""
  if (!orderId) {
    return NextResponse.json({ error: "orderId gerekli" }, { status: 400 })
  }

  const { data: order, error } = await auth.service
    .from("orders")
    .select("id, company_id, user_id, payment")
    .eq("id", orderId)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 })
  }
  if (!canAccessOrder(auth, order)) {
    return NextResponse.json({ error: "Bu siparişe erişiminiz yok" }, { status: 403 })
  }

  const payment = (order.payment ?? {}) as { receiptPath?: string }
  const path = payment.receiptPath ? String(payment.receiptPath) : ""
  if (!path) {
    return NextResponse.json({ error: "Dekont henüz yüklenmedi" }, { status: 404 })
  }

  const { data, error: signErr } = await auth.service.storage
    .from("payment-receipts")
    .createSignedUrl(path, 60 * 15)

  if (signErr || !data?.signedUrl) {
    return NextResponse.json({ error: signErr?.message ?? "URL oluşturulamadı" }, { status: 400 })
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: 900 })
}

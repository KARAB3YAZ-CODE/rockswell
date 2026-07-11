import { NextResponse } from "next/server"
import { requireBearerUser, canAccessOrder } from "@/lib/auth-api"

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
])

/**
 * Upload havale dekont for an order (owner/company or admin).
 * Uses service role to update frozen payment JSON + private storage.
 */
export async function POST(request: Request) {
  const auth = await requireBearerUser(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const form = await request.formData()
    const orderId = String(form.get("orderId") ?? "")
    const file = form.get("file")
    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli" }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Sadece PDF veya görsel (JPG/PNG/WebP) yükleyin" }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Dosya en fazla 10 MB olabilir" }, { status: 400 })
    }

    const { data: order, error } = await auth.service
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()
    if (error || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 })
    }
    if (!canAccessOrder(auth, order)) {
      return NextResponse.json({ error: "Bu siparişe erişiminiz yok" }, { status: 403 })
    }

    const payment = (order.payment ?? {}) as Record<string, unknown>
    if (String(payment.method) !== "havale") {
      return NextResponse.json({ error: "Bu sipariş havale/EFT değil" }, { status: 400 })
    }
    if (["cancelled", "returned"].includes(String(order.status))) {
      return NextResponse.json({ error: "İptal/iade siparişe dekont yüklenemez" }, { status: 400 })
    }
    if (String(payment.status) === "paid") {
      return NextResponse.json({ error: "Ödeme zaten onaylanmış" }, { status: 409 })
    }

    const ext =
      (file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg"))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin"
    const path = `${order.company_id}/${order.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const bytes = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await auth.service.storage.from("payment-receipts").upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    })
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    // Remove previous receipt if any
    const prevPath = payment.receiptPath ? String(payment.receiptPath) : ""
    if (prevPath && prevPath !== path) {
      try {
        await auth.service.storage.from("payment-receipts").remove([prevPath])
      } catch {
        /* best-effort */
      }
    }

    const nextPayment = {
      ...payment,
      method: "havale",
      status: "receipt_uploaded",
      receiptPath: path,
      receiptFileName: file.name.slice(0, 120),
      receiptUploadedAt: new Date().toISOString(),
    }

    const { data: updated, error: upOrderErr } = await auth.service
      .from("orders")
      .update({ payment: nextPayment })
      .eq("id", orderId)
      .select("*")
      .single()

    if (upOrderErr || !updated) {
      return NextResponse.json({ error: upOrderErr?.message ?? "Sipariş güncellenemedi" }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      receiptFileName: nextPayment.receiptFileName,
      receiptUploadedAt: nextPayment.receiptUploadedAt,
      paymentStatus: nextPayment.status,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Yükleme başarısız"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

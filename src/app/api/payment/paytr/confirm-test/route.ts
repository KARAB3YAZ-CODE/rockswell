import { NextResponse } from "next/server"
import { requireBearerUser, canAccessOrder } from "@/lib/auth-api"
import { getPaytrConfig } from "@/lib/paytr"
import { finalizePaidOnlineOrder } from "@/lib/payment-finalize"

/**
 * Test-only confirmation used while PayTR credentials are not configured.
 * Hard-disabled in production unless PAYTR_ALLOW_TEST_MODE=1.
 * Requires authenticated order owner (or admin).
 */
export async function POST(request: Request) {
  const allowTest =
    process.env.PAYTR_ALLOW_TEST_MODE === "1" ||
    process.env.NODE_ENV !== "production"

  if (!allowTest) {
    return NextResponse.json(
      { error: "Test ödeme onayı production ortamında kapalı" },
      { status: 403 }
    )
  }

  if (getPaytrConfig()) {
    return NextResponse.json({ error: "PayTR aktif — test onayı devre dışı" }, { status: 403 })
  }

  const auth = await requireBearerUser(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const orderId = String((body as { orderId?: string }).orderId ?? "")
    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli" }, { status: 400 })
    }

    const { data: order, error: fetchErr } = await auth.service
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 })
    }

    if (!canAccessOrder(auth, order)) {
      return NextResponse.json({ error: "Bu siparişe erişiminiz yok" }, { status: 403 })
    }

    const payment = (order.payment ?? {}) as { method?: string; status?: string }
    if (payment.method !== "online") {
      return NextResponse.json({ error: "Bu sipariş online ödeme için değil" }, { status: 400 })
    }
    if (String(order.status) !== "draft") {
      return NextResponse.json({ error: "Sipariş test onayı için uygun durumda değil" }, { status: 400 })
    }

    const result = await finalizePaidOnlineOrder(auth.service, order, { testMode: true })
    return NextResponse.json({ ok: true, alreadyPaid: result.alreadyPaid })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onay başarısız"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

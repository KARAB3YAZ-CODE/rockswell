import { NextResponse } from "next/server"
import { requireBearerUser, canAccessOrder } from "@/lib/auth-api"
import { getPaytrConfig, orderIdToOid, buildTokenHash } from "@/lib/paytr"

function getBaseUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, "")
  const origin = request.headers.get("origin")
  if (origin) return origin
  const host = request.headers.get("host")
  return host ? `https://${host}` : "https://www.rockswell.store"
}

export async function POST(request: Request) {
  try {
    const auth = await requireBearerUser(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const orderId = String((body as { orderId?: string }).orderId ?? "")
    const emailOverride = (body as { email?: string }).email
    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli" }, { status: 400 })
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

    const payment = (order.payment ?? {}) as { method?: string; status?: string }
    if (payment.method !== "online") {
      return NextResponse.json({ error: "Bu sipariş online ödeme için değil" }, { status: 400 })
    }
    if (payment.status === "paid" || ["confirmed", "processing", "shipped", "delivered"].includes(String(order.status))) {
      return NextResponse.json({ error: "Sipariş zaten ödenmiş" }, { status: 409 })
    }
    if (String(order.status) !== "draft") {
      return NextResponse.json({ error: "Sipariş ödeme için uygun durumda değil" }, { status: 400 })
    }

    const amount = Number(order.pricing?.grandTotal ?? 0)
    if (amount <= 0) {
      return NextResponse.json({ error: "Geçersiz sipariş tutarı" }, { status: 400 })
    }

    const config = getPaytrConfig()
    const allowTest =
      process.env.PAYTR_ALLOW_TEST_MODE === "1" ||
      process.env.NODE_ENV !== "production"

    if (!config) {
      if (!allowTest) {
        return NextResponse.json(
          { error: "Online ödeme şu an yapılandırılmamış. Lütfen Havale/EFT seçin veya yöneticiye bildirin." },
          { status: 503 }
        )
      }
      return NextResponse.json({ testMode: true, amount })
    }

    const { data: company } = await auth.service
      .from("companies")
      .select("name, phone, address, email")
      .eq("id", order.company_id)
      .single()

    const merchantOid = orderIdToOid(order.id)
    const paymentAmount = Math.round(amount * 100)
    const userIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1"

    const basket = (order.items ?? []).map(
      (item: { productName: string; unitPrice: number; quantity: number }) => [
        item.productName,
        item.unitPrice.toFixed(2),
        item.quantity,
      ]
    )
    const userBasket = Buffer.from(JSON.stringify(basket)).toString("base64")

    const userEmail =
      (typeof emailOverride === "string" && emailOverride.includes("@")
        ? emailOverride
        : null) ||
      auth.email ||
      company?.email ||
      "musteri@rockswell.store"
    const noInstallment = "0"
    const maxInstallment = "0"
    const currency = "TL"

    const paytrToken = buildTokenHash({
      config,
      userIp,
      merchantOid,
      email: userEmail,
      paymentAmount,
      userBasket,
      noInstallment,
      maxInstallment,
      currency,
    })

    const baseUrl = getBaseUrl(request)
    const addr = (company?.address ?? {}) as {
      street?: string
      district?: string
      city?: string
    }
    const form = new URLSearchParams({
      merchant_id: config.merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email: userEmail,
      payment_amount: String(paymentAmount),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: config.testMode ? "1" : "0",
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: company?.name ?? "Müşteri",
      user_address:
        `${addr.street ?? ""} ${addr.district ?? ""} ${addr.city ?? ""}`.trim() || "Türkiye",
      user_phone: company?.phone ?? "0000000000",
      merchant_ok_url: `${baseUrl}/orders/${order.id}?paid=1`,
      merchant_fail_url: `${baseUrl}/payment/${order.id}?failed=1`,
      timeout_limit: "30",
      currency,
      test_mode: config.testMode ? "1" : "0",
    })

    await auth.service
      .from("orders")
      .update({
        payment: {
          ...(order.payment ?? {}),
          method: "online",
          status: payment.status ?? "pending",
          merchantOid,
        },
      })
      .eq("id", order.id)

    const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })
    const result = await res.json()

    if (result.status !== "success") {
      return NextResponse.json(
        { error: result.reason ?? "PayTR token alınamadı" },
        { status: 400 }
      )
    }

    return NextResponse.json({ token: result.token })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ödeme başlatılamadı"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

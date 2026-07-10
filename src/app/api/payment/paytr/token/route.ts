import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-admin"
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
    const { orderId, email } = await request.json()
    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli" }, { status: 400 })
    }

    const service = getServiceClient()
    const { data: order, error } = await service
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 })
    }

    const amount = Number(order.pricing?.grandTotal ?? 0)
    if (amount <= 0) {
      return NextResponse.json({ error: "Geçersiz sipariş tutarı" }, { status: 400 })
    }

    const config = getPaytrConfig()

    // Not configured yet → test mode so the flow is demoable until credentials are added.
    if (!config) {
      return NextResponse.json({ testMode: true, amount })
    }

    const { data: company } = await service
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

    const userEmail = email || company?.email || "musteri@rockswell.store"
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
    const addr = company?.address ?? {}
    const form = new URLSearchParams({
      merchant_id: config.merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email: userEmail,
      payment_amount: String(paymentAmount),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: "1",
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: company?.name ?? "Müşteri",
      user_address: `${addr.street ?? ""} ${addr.district ?? ""} ${addr.city ?? ""}`.trim() || "Türkiye",
      user_phone: company?.phone ?? "0000000000",
      merchant_ok_url: `${baseUrl}/orders/${order.id}?paid=1`,
      merchant_fail_url: `${baseUrl}/payment/${order.id}?failed=1`,
      timeout_limit: "30",
      currency,
      test_mode: config.testMode ? "1" : "0",
    })

    // Persist the oid mapping so the callback can resolve the order.
    await service
      .from("orders")
      .update({ payment: { ...(order.payment ?? {}), merchantOid } })
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

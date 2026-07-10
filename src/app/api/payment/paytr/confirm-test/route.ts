import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-admin"
import { getPaytrConfig } from "@/lib/paytr"
import { createInvoiceForOrder } from "@/lib/invoices"

/**
 * Test-only confirmation used while PayTR credentials are not configured,
 * so the online-payment flow is demoable. Disabled once PayTR is live.
 */
export async function POST(request: Request) {
  if (getPaytrConfig()) {
    return NextResponse.json({ error: "PayTR aktif — test onayı devre dışı" }, { status: 403 })
  }

  try {
    const { orderId } = await request.json()
    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli" }, { status: 400 })
    }

    const service = getServiceClient()
    const { data: order } = await service
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    const { error } = await service
      .from("orders")
      .update({
        status: "confirmed",
        payment: {
          ...(order?.payment ?? {}),
          method: "online",
          status: "paid",
          paidDate: new Date().toISOString(),
          testMode: true,
        },
      })
      .eq("id", orderId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (order) {
      try {
        await createInvoiceForOrder(service, order)
      } catch {
        /* best-effort */
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onay başarısız"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

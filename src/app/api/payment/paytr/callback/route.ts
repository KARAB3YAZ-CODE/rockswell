import { getServiceClient } from "@/lib/supabase-admin"
import { getPaytrConfig, verifyCallbackHash } from "@/lib/paytr"
import { createInvoiceForOrder } from "@/lib/invoices"

export async function POST(request: Request) {
  const config = getPaytrConfig()
  if (!config) {
    return new Response("PAYTR_NOT_CONFIGURED", { status: 200 })
  }

  const form = await request.formData()
  const merchantOid = String(form.get("merchant_oid") ?? "")
  const status = String(form.get("status") ?? "")
  const totalAmount = String(form.get("total_amount") ?? "")
  const hash = String(form.get("hash") ?? "")

  const valid = verifyCallbackHash({ config, merchantOid, status, totalAmount, hash })
  if (!valid) {
    return new Response("PAYTR notification failed: bad hash", { status: 400 })
  }

  const service = getServiceClient()
  const { data: order } = await service
    .from("orders")
    .select("*")
    .eq("payment->>merchantOid", merchantOid)
    .single()

  if (!order) {
    // Respond OK so PayTR stops retrying; nothing to update.
    return new Response("OK", { status: 200 })
  }

  if (status === "success") {
    await service
      .from("orders")
      .update({
        status: "confirmed",
        payment: { ...(order.payment ?? {}), status: "paid", paidDate: new Date().toISOString() },
      })
      .eq("id", order.id)
    try {
      await createInvoiceForOrder(service, order)
    } catch {
      /* best-effort */
    }
    try {
      await service
        .from("invoices")
        .update({ status: "paid", paid_date: new Date().toISOString() })
        .eq("order_id", order.id)
        .neq("status", "cancelled")
    } catch {
      /* best-effort */
    }
  } else {
    await service
      .from("orders")
      .update({
        status: "cancelled",
        payment: { ...(order.payment ?? {}), status: "failed" },
      })
      .eq("id", order.id)
  }

  return new Response("OK", { status: 200 })
}

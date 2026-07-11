import { getPaytrConfig, verifyCallbackHash } from "@/lib/paytr"
import {
  failOnlineOrder,
  findOrderByMerchantOid,
  finalizePaidOnlineOrder,
  PaymentAmountMismatchError,
} from "@/lib/payment-finalize"
import { getServiceClient } from "@/lib/supabase-admin"

/**
 * PayTR notification URL (server-to-server).
 * Must always acknowledge with "OK" when hash is valid so PayTR stops retrying.
 */
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
  const order = await findOrderByMerchantOid(service, merchantOid)
  if (!order) {
    // Unknown oid — acknowledge so PayTR does not retry forever
    return new Response("OK", { status: 200 })
  }

  try {
    if (status === "success") {
      await finalizePaidOnlineOrder(service, order, {
        paidAmountKurus: Number(totalAmount),
      })
    } else {
      await failOnlineOrder(service, order)
    }
  } catch (e) {
    if (e instanceof PaymentAmountMismatchError) {
      // Do not OK amount mismatches — PayTR will retry / ops can investigate
      console.error("[paytr/callback]", e.message, { orderId: order.id, merchantOid })
      return new Response("PAYTR notification failed: amount mismatch", { status: 400 })
    }
    console.error("[paytr/callback]", e)
    // Transient errors: non-OK so PayTR retries
    return new Response("PAYTR notification failed: processing error", { status: 500 })
  }

  return new Response("OK", { status: 200 })
}

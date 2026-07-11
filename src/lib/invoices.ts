import type { SupabaseClient } from "@supabase/supabase-js"
import { TAX_RATE } from "./pricing"
import { OPEN_ACCOUNT_METHOD, openAccountDueDate } from "./credit"

interface OrderRowLike {
  id: string
  order_number: string
  company_id: string
  items?: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>
  pricing?: {
    subtotal?: number
    taxTotal?: number
    discountTotal?: number
    grandTotal?: number
  }
  payment?: { method?: string } | null
}

function resolveDueDate(paymentMethod?: string | null): Date {
  if (paymentMethod === OPEN_ACCOUNT_METHOD) {
    return openAccountDueDate()
  }
  // Havale/EFT: 7 gün içinde dekont beklenir
  if (paymentMethod === "havale") {
    return new Date(Date.now() + 7 * 864e5)
  }
  // Online / diğer
  return new Date(Date.now() + 3 * 864e5)
}

/**
 * Creates an invoice for an order if one does not already exist.
 * Safe to call from both the service client (payment callbacks) and
 * admin client (order approval). Idempotent per order.
 */
export async function createInvoiceForOrder(
  client: SupabaseClient,
  order: OrderRowLike
): Promise<void> {
  const { data: existing } = await client
    .from("invoices")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle()

  if (existing) return

  const items = (order.items ?? []).map((item) => ({
    description: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: TAX_RATE * 100,
    total: item.totalPrice,
  }))

  const pricing = order.pricing ?? {}
  const method = order.payment?.method
  const dueDate = resolveDueDate(method)

  await client.from("invoices").insert({
    invoice_number: `FAT-${order.order_number}`,
    order_id: order.id,
    company_id: order.company_id,
    type: "invoice",
    status: "sent",
    items,
    subtotal: Number(pricing.subtotal ?? 0),
    tax_total: Number(pricing.taxTotal ?? 0),
    discount_total: Number(pricing.discountTotal ?? 0),
    grand_total: Number(pricing.grandTotal ?? 0),
    currency: "TRY",
    due_date: dueDate.toISOString(),
  })
}

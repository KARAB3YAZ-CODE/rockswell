import type { SupabaseClient } from "@supabase/supabase-js"
import { createInvoiceForOrder } from "@/lib/invoices"
import { applyStockMovement, orderItemsToStockLines } from "@/lib/inventory"

export class PaymentAmountMismatchError extends Error {
  constructor(
    public readonly expectedKurus: number,
    public readonly receivedKurus: number
  ) {
    super(
      `Ödeme tutarı uyuşmuyor (beklenen ${expectedKurus} kuruş, gelen ${receivedKurus} kuruş)`
    )
    this.name = "PaymentAmountMismatchError"
  }
}

type OrderRow = {
  id: string
  order_number: string
  company_id: string
  status: string
  items?: unknown
  pricing?: { grandTotal?: number; subtotal?: number; taxTotal?: number; discountTotal?: number } | null
  payment?: Record<string, unknown> | null
}

function stockLines(order: OrderRow) {
  return orderItemsToStockLines(
    (Array.isArray(order.items) ? order.items : []) as Array<{
      productId: string
      warehouseId: string
      quantity: number
      productName?: string
    }>
  )
}

function expectedAmountKurus(order: OrderRow): number {
  return Math.round(Number(order.pricing?.grandTotal ?? 0) * 100)
}

function isAlreadyPaid(order: OrderRow): boolean {
  const paymentStatus = String(order.payment?.status ?? "")
  if (paymentStatus === "paid") return true
  return ["confirmed", "processing", "shipped", "delivered"].includes(String(order.status))
}

/**
 * Idempotent online payment success path:
 * draft → confirmed + paid, stock commit, invoice (paid).
 * Safe under PayTR callback retries.
 */
export async function finalizePaidOnlineOrder(
  service: SupabaseClient,
  order: OrderRow,
  opts?: {
    testMode?: boolean
    /** PayTR total_amount (kuruş). When set, must match order grandTotal. */
    paidAmountKurus?: number
  }
): Promise<{ alreadyPaid: boolean }> {
  if (isAlreadyPaid(order)) return { alreadyPaid: true }

  if (opts?.paidAmountKurus != null) {
    const expected = expectedAmountKurus(order)
    const received = Number(opts.paidAmountKurus)
    if (!Number.isFinite(received) || expected !== received) {
      throw new PaymentAmountMismatchError(expected, received)
    }
  }

  const payment = { ...(order.payment ?? {}) } as Record<string, unknown>
  const paidDate = new Date().toISOString()
  const nextPayment = {
    ...payment,
    method: payment.method ?? "online",
    status: "paid",
    paidDate,
    ...(opts?.testMode ? { testMode: true } : {}),
    ...(opts?.paidAmountKurus != null ? { paidAmountKurus: opts.paidAmountKurus } : {}),
  }

  // Race-safe: only transition unpaid draft-like rows
  const { data: updated, error } = await service
    .from("orders")
    .update({
      status: "confirmed",
      payment: nextPayment,
    })
    .eq("id", order.id)
    .in("status", ["draft", "pending_approval", "approved", "quotation"])
    .select("*")
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!updated) {
    // Another worker won the race or order already moved on
    const { data: fresh } = await service.from("orders").select("*").eq("id", order.id).maybeSingle()
    if (fresh && isAlreadyPaid(fresh as OrderRow)) return { alreadyPaid: true }
    throw new Error("Sipariş ödeme için uygun durumda değil")
  }

  const lines = stockLines(updated as OrderRow)
  try {
    await applyStockMovement(service, lines, "commit")
  } catch {
    /* reservation may already be committed in edge retries — continue */
  }

  try {
    await createInvoiceForOrder(service, {
      id: String(updated.id),
      order_number: String(updated.order_number),
      company_id: String(updated.company_id),
      items: Array.isArray(updated.items)
        ? (updated.items as Array<{
            productName: string
            quantity: number
            unitPrice: number
            totalPrice: number
          }>)
        : [],
      pricing: (updated.pricing ?? {}) as {
        subtotal?: number
        taxTotal?: number
        discountTotal?: number
        grandTotal?: number
      },
      payment: (updated.payment ?? null) as { method?: string } | null,
    })
  } catch {
    /* idempotent create */
  }

  try {
    await service
      .from("invoices")
      .update({ status: "paid", paid_date: paidDate })
      .eq("order_id", order.id)
      .neq("status", "cancelled")
  } catch {
    /* best-effort */
  }

  return { alreadyPaid: false }
}

/**
 * Idempotent online payment failure: cancel draft + release reservation.
 * Never cancels an already-paid order (late/duplicate fail callbacks).
 */
export async function failOnlineOrder(
  service: SupabaseClient,
  order: OrderRow
): Promise<{ ignored: boolean }> {
  if (isAlreadyPaid(order)) return { ignored: true }
  if (String(order.status) === "cancelled") return { ignored: true }

  const payment = { ...(order.payment ?? {}) } as Record<string, unknown>
  const { data: updated, error } = await service
    .from("orders")
    .update({
      status: "cancelled",
      payment: { ...payment, status: "failed" },
    })
    .eq("id", order.id)
    .in("status", ["draft", "pending_approval", "approved", "quotation"])
    .select("*")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!updated) return { ignored: true }

  try {
    await applyStockMovement(service, stockLines(updated as OrderRow), "release")
  } catch {
    /* best-effort */
  }

  return { ignored: false }
}

/** Resolve order for PayTR merchant_oid (stored on payment or derived from uuid). */
export async function findOrderByMerchantOid(
  service: SupabaseClient,
  merchantOid: string
): Promise<OrderRow | null> {
  if (!merchantOid) return null

  const { data: byField } = await service
    .from("orders")
    .select("*")
    .eq("payment->>merchantOid", merchantOid)
    .maybeSingle()
  if (byField) return byField as OrderRow

  // Standard UUID without hyphens → reconstruct and lookup by id
  if (/^[a-f0-9]{32}$/i.test(merchantOid)) {
    const reconstructed =
      `${merchantOid.slice(0, 8)}-${merchantOid.slice(8, 12)}-` +
      `${merchantOid.slice(12, 16)}-${merchantOid.slice(16, 20)}-${merchantOid.slice(20)}`
    const { data: byId } = await service
      .from("orders")
      .select("*")
      .eq("id", reconstructed.toLowerCase())
      .maybeSingle()
    if (byId) return byId as OrderRow
  }

  return null
}

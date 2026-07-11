import { supabase } from "./supabase"

/** Open-account payment method slug stored on orders.payment.method */
export const OPEN_ACCOUNT_METHOD = "acik_hesap" as const

export interface CompanyCreditSnapshot {
  creditLimit: number
  /** Open açık-hesap invoices + pending açık-hesap orders without invoice */
  creditUsed: number
  creditRemaining: number
  openInvoicesAmount: number
  pendingOrdersAmount: number
  /** True when previous-period açık hesap debts are unpaid (after due / 15th rule) */
  openAccountBlocked: boolean
  openAccountBlockReason: string | null
  unpaidPastDueCount: number
  unpaidPastDueAmount: number
}

const OPEN_ACCOUNT_STATUSES = ["pending_approval", "approved"] as const

function money(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Açık hesap fatura vadesi: bir sonraki ayın 15'i (gün sonu). */
export function openAccountDueDate(from: Date = new Date()): Date {
  const y = from.getFullYear()
  const m = from.getMonth() + 1
  return new Date(y, m, 15, 23, 59, 59, 999)
}

function isOpenAccountMethod(method?: string | null): boolean {
  return method === OPEN_ACCOUNT_METHOD
}

/** Shared credit exposure for a company (used by dashboard + checkout). */
export async function getCompanyCreditSnapshot(companyId: string): Promise<CompanyCreditSnapshot> {
  const [{ data: company }, { data: invoices }, { data: pendingOrders }, { data: invoicedOrderRows }] =
    await Promise.all([
      supabase.from("companies").select("credit_limit").eq("id", companyId).maybeSingle(),
      supabase
        .from("invoices")
        .select("id, grand_total, status, due_date, order_id")
        .eq("company_id", companyId)
        .in("status", ["sent", "overdue"]),
      supabase
        .from("orders")
        .select("id, pricing, payment, status")
        .eq("company_id", companyId)
        .in("status", [...OPEN_ACCOUNT_STATUSES]),
      supabase.from("invoices").select("order_id").eq("company_id", companyId).not("order_id", "is", null),
    ])

  const creditLimit = Math.max(0, Number(company?.credit_limit ?? 0))

  const orderIds = [
    ...new Set(
      [
        ...(invoices ?? []).map((i) => (i.order_id ? String(i.order_id) : "")),
        ...(pendingOrders ?? []).map((o) => String(o.id)),
      ].filter(Boolean)
    ),
  ]

  const methodByOrderId = new Map<string, string>()
  if (orderIds.length > 0) {
    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, payment")
      .in("id", orderIds)
    for (const row of orderRows ?? []) {
      const payment = (row.payment ?? {}) as { method?: string }
      methodByOrderId.set(String(row.id), String(payment.method ?? ""))
    }
  }

  const today = startOfToday().getTime()
  let openInvoicesAmount = 0
  let unpaidPastDueCount = 0
  let unpaidPastDueAmount = 0

  for (const inv of invoices ?? []) {
    const orderId = inv.order_id ? String(inv.order_id) : ""
    const method = orderId ? methodByOrderId.get(orderId) : OPEN_ACCOUNT_METHOD
    // Legacy invoices (pre-split): if method missing/unknown, count as açık hesap debt
    const countsAsOpenAccount =
      !method || method === OPEN_ACCOUNT_METHOD || method === "havale"
    if (!countsAsOpenAccount) continue

    const amount = Number(inv.grand_total ?? 0)
    openInvoicesAmount += amount

    const due = inv.due_date ? new Date(String(inv.due_date)).getTime() : 0
    if (due > 0 && due < today) {
      unpaidPastDueCount += 1
      unpaidPastDueAmount += amount
    }
  }

  const invoicedOrderIds = new Set(
    (invoicedOrderRows ?? []).map((r) => String(r.order_id)).filter(Boolean)
  )

  let pendingOrdersAmount = 0
  for (const row of pendingOrders ?? []) {
    if (invoicedOrderIds.has(String(row.id))) continue
    const payment = (row.payment ?? {}) as { method?: string; status?: string }
    if (!isOpenAccountMethod(payment.method)) continue
    if (payment.status === "paid") continue
    pendingOrdersAmount += Number(
      (row.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0
    )
  }

  const creditUsed = openInvoicesAmount + pendingOrdersAmount

  let openAccountBlocked = false
  let openAccountBlockReason: string | null = null
  if (unpaidPastDueCount > 0) {
    openAccountBlocked = true
    openAccountBlockReason = `Vadesi geçmiş açık hesap borcunuz var (${unpaidPastDueCount} fatura, ${money(unpaidPastDueAmount)}). Açık hesap ödemeleri her ayın 15’ine kadar yapılmalıdır. Ödeme yapılmadan yeni açık hesap siparişi açılamaz.`
  }

  return {
    creditLimit,
    creditUsed,
    creditRemaining: Math.max(0, creditLimit - creditUsed),
    openInvoicesAmount,
    pendingOrdersAmount,
    openAccountBlocked,
    openAccountBlockReason,
    unpaidPastDueCount,
    unpaidPastDueAmount,
  }
}

/** Throws if açık hesap order would exceed company credit. */
export function assertCreditAllowsOrder(
  snap: CompanyCreditSnapshot,
  orderTotal: number
): void {
  const total = Math.max(0, Number(orderTotal) || 0)

  if (snap.creditLimit <= 0) {
    throw new Error(
      "Firmanız için açık hesap (kredi) tanımlı değil. Havale/EFT veya online ödeme kullanın ya da yöneticinizle iletişime geçin."
    )
  }

  if (snap.creditUsed + total > snap.creditLimit + 0.009) {
    throw new Error(
      `Açık hesap limitiniz yetersiz. Limit ${money(snap.creditLimit)}, kullanılan ${money(snap.creditUsed)}, kalan ${money(snap.creditRemaining)}. Bu sipariş ${money(total)}. Havale/EFT veya online ödeme seçebilir ya da limit artırımı talep edebilirsiniz.`
    )
  }
}

/** Throws if previous-period açık hesap invoices are past due (15th rule). */
export function assertOpenAccountPeriodClear(snap: CompanyCreditSnapshot): void {
  if (snap.openAccountBlocked) {
    throw new Error(
      snap.openAccountBlockReason ||
        "Vadesi geçmiş açık hesap borcunuz nedeniyle yeni açık hesap siparişi açılamaz."
    )
  }
}

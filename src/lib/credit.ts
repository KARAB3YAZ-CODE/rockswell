import { supabase } from "./supabase"

export interface CompanyCreditSnapshot {
  creditLimit: number
  /** Open invoices (sent/overdue) + pending open-account orders without invoice */
  creditUsed: number
  creditRemaining: number
  openInvoicesAmount: number
  pendingOrdersAmount: number
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

/** Shared credit exposure for a company (used by dashboard + checkout). */
export async function getCompanyCreditSnapshot(companyId: string): Promise<CompanyCreditSnapshot> {
  const [{ data: company }, { data: invoices }, { data: pendingOrders }, { data: invoicedOrderRows }] =
    await Promise.all([
      supabase.from("companies").select("credit_limit").eq("id", companyId).maybeSingle(),
      supabase
        .from("invoices")
        .select("grand_total, status")
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
  const openInvoicesAmount = (invoices ?? []).reduce(
    (sum, inv) => sum + Number(inv.grand_total ?? 0),
    0
  )

  const invoicedOrderIds = new Set(
    (invoicedOrderRows ?? []).map((r) => String(r.order_id)).filter(Boolean)
  )

  let pendingOrdersAmount = 0
  for (const row of pendingOrders ?? []) {
    if (invoicedOrderIds.has(String(row.id))) continue
    const payment = (row.payment ?? {}) as { method?: string; status?: string }
    if (payment.method === "online") continue
    if (payment.status === "paid") continue
    pendingOrdersAmount += Number(
      (row.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0
    )
  }

  const creditUsed = openInvoicesAmount + pendingOrdersAmount
  return {
    creditLimit,
    creditUsed,
    creditRemaining: Math.max(0, creditLimit - creditUsed),
    openInvoicesAmount,
    pendingOrdersAmount,
  }
}

/** Throws if open-account (havale) order would exceed company credit. */
export function assertCreditAllowsOrder(
  snap: CompanyCreditSnapshot,
  orderTotal: number
): void {
  const total = Math.max(0, Number(orderTotal) || 0)

  if (snap.creditLimit <= 0) {
    throw new Error(
      "Firmanız için açık hesap (kredi) tanımlı değil. Online ödeme kullanın veya yöneticinizle iletişime geçin."
    )
  }

  if (snap.creditUsed + total > snap.creditLimit + 0.009) {
    throw new Error(
      `Kredi limitiniz yetersiz. Limit ${money(snap.creditLimit)}, kullanılan ${money(snap.creditUsed)}, kalan ${money(snap.creditRemaining)}. Bu sipariş ${money(total)}. Online ödeme seçebilir veya limit artırımı talep edebilirsiniz.`
    )
  }
}

"use client"

import Link from "next/link"
import { Shell } from "@/components/layout/shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useData } from "@/hooks/use-data"
import { getInvoices } from "@/lib/api"
import { formatDate, formatPrice } from "@/lib/utils"
import { FileText, Printer, ShoppingBag } from "lucide-react"

const statusConfig: Record<string, { label: string; color: "success" | "info" | "warning" | "danger" | "default" }> = {
  draft: { label: "Taslak", color: "default" },
  sent: { label: "Bekliyor", color: "info" },
  paid: { label: "Ödendi", color: "success" },
  overdue: { label: "Gecikmiş", color: "danger" },
  cancelled: { label: "İptal", color: "default" },
}

export default function InvoicesPage() {
  const { data: invoices, loading } = useData(() => getInvoices(), [])

  return (
    <Shell>
      <div className="max-w-3xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Faturalar</h2>
          <p className="text-sm text-white/40">Fatura ve muhasebe işlemleri</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (invoices?.length ?? 0) === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FileText size={32} className="mx-auto text-white/20" />
            <p className="text-sm text-white/40">Henüz fatura bulunmuyor.</p>
            <p className="text-xs text-white/30">Siparişiniz onaylandığında faturanız burada görünür.</p>
            <Link href="/orders">
              <Button size="sm" icon={<ShoppingBag size={14} />}>Siparişlerime Git</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices!.map((inv) => {
              const status = statusConfig[inv.status] ?? statusConfig.draft
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <Link
                    href={inv.orderId ? `/orders/${inv.orderId}` : "/orders"}
                    className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90"
                  >
                    <div className="w-9 h-9 rounded-xl bg-info/10 text-info flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{inv.invoiceNumber}</p>
                      <p className="text-xs text-white/40">
                        {formatDate(inv.createdAt)}
                        {inv.dueDate ? ` · Vade ${formatDate(inv.dueDate)}` : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-sm font-bold text-white">{formatPrice(inv.grandTotal)}</p>
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant={status.color} size="sm">{status.label}</Badge>
                      <button
                        type="button"
                        title="Yazdır"
                        onClick={() => window.print()}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5"
                      >
                        <Printer size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}

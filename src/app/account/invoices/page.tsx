"use client"

import { Shell } from "@/components/layout/shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useOrders } from "@/hooks/use-data"
import { formatDate, formatPrice } from "@/lib/utils"
import { FileText } from "lucide-react"

export default function InvoicesPage() {
  const { orders, loading } = useOrders()
  const invoiceOrders = orders.slice(0, 10)

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
        ) : invoiceOrders.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40">Henüz fatura bulunmuyor.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invoiceOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-info/10 text-info flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">FAT-{order.orderNumber.slice(-4)}</p>
                    <p className="text-xs text-white/40">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatPrice(order.pricing.grandTotal)}</p>
                  <Badge variant={order.status === "delivered" ? "success" : "info"} size="sm">
                    {order.status === "delivered" ? "Ödendi" : "Bekliyor"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

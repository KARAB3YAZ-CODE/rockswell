"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatPrice } from "@/lib/utils"
import type { Order } from "@/lib/types"
import { Package, Truck, CheckCircle, Clock, XCircle, Eye } from "lucide-react"

const statusConfig = {
  draft: { label: "Taslak", color: "default" as const, icon: Clock },
  pending_approval: { label: "Onay Bekliyor", color: "warning" as const, icon: Clock },
  approved: { label: "Onaylandı", color: "info" as const, icon: CheckCircle },
  quotation: { label: "Teklif", color: "info" as const, icon: FileText },
  confirmed: { label: "Onaylandı", color: "success" as const, icon: CheckCircle },
  processing: { label: "Hazırlanıyor", color: "info" as const, icon: Package },
  shipped: { label: "Kargoda", color: "info" as const, icon: Truck },
  delivered: { label: "Teslim Edildi", color: "success" as const, icon: CheckCircle },
  cancelled: { label: "İptal Edildi", color: "danger" as const, icon: XCircle },
  returned: { label: "İade", color: "warning" as const, icon: XCircle },
}

import { FileText } from "lucide-react"

export function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Son Siparişler</CardTitle>
        <Link href="/orders" className="text-xs text-accent hover:text-accent/80 transition-colors">Tümünü Gör</Link>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-white/30 pb-3">Sipariş No</th>
                <th className="text-left text-xs font-medium text-white/30 pb-3">Tarih</th>
                <th className="text-left text-xs font-medium text-white/30 pb-3">Durum</th>
                <th className="text-right text-xs font-medium text-white/30 pb-3">Tutar</th>
                <th className="text-right text-xs font-medium text-white/30 pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const status = statusConfig[order.status]
                const StatusIcon = status.icon
                return (
                  <motion.tr
                    key={order.id}
                    className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <td className="py-3">
                      <span className="text-sm font-medium text-white">{order.orderNumber}</span>
                    </td>
                    <td className="py-3">
                      <span className="text-sm text-white/50">{formatDate(order.createdAt)}</span>
                    </td>
                    <td className="py-3">
                      <Badge variant={status.color} size="sm">
                        <StatusIcon size={10} />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-sm text-white font-medium">
                      {formatPrice(order.pricing.grandTotal)}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/orders?id=${order.id}`}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center hover:bg-white/5 text-white/30 hover:text-white transition-colors"
                      >
                        <Eye size={14} />
                      </Link>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

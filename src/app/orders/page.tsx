"use client"

import { useState, Suspense, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Shell } from "@/components/layout/shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrders } from "@/hooks/use-data"
import { formatDate, formatPrice, cn } from "@/lib/utils"
import {
  Package, Truck, CheckCircle, Clock, XCircle,
  ChevronDown, Search, FileText,
  Filter, RefreshCw,
} from "lucide-react"

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

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  )
}

function hasPartialReturn(order: { status: string; items: Array<{ returnedQuantity?: number }> }) {
  if (order.status === "returned") return true
  return order.items.some((i) => Number(i.returnedQuantity ?? 0) > 0)
}

function OrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const returnsOnly = searchParams.get("returns") === "1" || searchParams.get("status") === "returned"
  const [statusFilter, setStatusFilter] = useState<string | null>(() => {
    const s = searchParams.get("status")
    return s === "returned" ? null : s
  })
  const { orders: allOrders, loading, refetch } = useOrders()

  useEffect(() => {
    const next = searchParams.get("status")
    if (next === "returned") setStatusFilter(null)
    else setStatusFilter(next)
  }, [searchParams])

  const applyStatus = (key: string | null) => {
    setStatusFilter(key === "returned" ? null : key)
    const params = new URLSearchParams()
    if (key === "returned") params.set("returns", "1")
    else if (key) params.set("status", key)
    const qs = params.toString()
    router.replace(qs ? `/orders?${qs}` : "/orders", { scroll: false })
  }

  let orders = [...allOrders]
  if (searchQuery) {
    orders = orders.filter((o) => o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  }
  if (returnsOnly) {
    orders = orders.filter(hasPartialReturn)
  } else if (statusFilter) {
    orders = orders.filter((o) => o.status === statusFilter)
  }
  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Siparişler</h1>
            <p className="text-sm text-white/40">{loading ? "..." : `${orders.length} sipariş`}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Filter size={14} />}
              onClick={() => {
                applyStatus(null)
                setSearchQuery("")
              }}
            >
              Filtreyi Temizle
            </Button>
            <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
              Yenile
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sipariş no ile ara..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: null, label: "Tümü" },
              { key: "draft", label: "Ödeme Bekleyen" },
              { key: "pending_approval", label: "Onay Bekleyen" },
              { key: "confirmed", label: "Onaylanan" },
              { key: "quotation", label: "Teklif" },
              { key: "processing", label: "Hazırlanıyor" },
              { key: "shipped", label: "Kargoda" },
              { key: "delivered", label: "Teslim Edilen" },
              { key: "returned", label: "İade" },
            ].map((f) => (
              <button
                key={f.key || "all"}
                onClick={() => applyStatus(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  (f.key === "returned" ? returnsOnly : !returnsOnly && statusFilter === f.key)
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "bg-white/5 text-white/40 hover:text-white/70 border border-white/10"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && orders.length === 0 && (
          <GlassCard intensity="light" className="p-12 text-center">
            <Package size={40} className="mx-auto text-white/15 mb-4" />
            <p className="text-sm font-medium text-white/60">Sipariş bulunamadı</p>
            <p className="text-xs text-white/30 mt-1">
              {searchQuery || statusFilter || returnsOnly
                ? "Arama veya filtre kriterlerinizi değiştirmeyi deneyin"
                : "Henüz sipariş oluşturulmamış"}
            </p>
          </GlassCard>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order, i) => {
              const status = statusConfig[order.status] ?? statusConfig.draft
              const StatusIcon = status.icon
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/orders/${order.id}`} className="block w-full text-left">
                    <GlassCard intensity="light" className="p-4 hover:bg-white/[0.06] transition-colors block">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              status.color === "success" && "bg-success/10 text-success",
                              status.color === "warning" && "bg-warning/10 text-warning",
                              status.color === "danger" && "bg-danger/10 text-danger",
                              status.color === "info" && "bg-info/10 text-info",
                              status.color === "default" && "bg-white/5 text-white/40"
                            )}
                          >
                            <StatusIcon size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{order.orderNumber}</span>
                              <Badge variant={status.color} size="sm">
                                {status.label}
                              </Badge>
                              {hasPartialReturn(order) && order.status !== "returned" && (
                                <Badge variant="warning" size="sm">
                                  Kısmi iade
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-white/40 mt-0.5">
                              {formatDate(order.createdAt)} • {order.items.length} ürün
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 sm:text-right">
                          <div>
                            <p className="text-sm font-bold text-white">{formatPrice(order.pricing.grandTotal)}</p>
                            {order.shipping.trackingNumber && (
                              <p className="text-xs text-info">Takip: {order.shipping.trackingNumber}</p>
                            )}
                          </div>
                          <ChevronDown size={16} className="text-white/20 -rotate-90" />
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}

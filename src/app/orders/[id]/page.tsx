"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getOrderById, requestOrderReturn } from "@/lib/api"
import { formatDate, formatPrice, cn } from "@/lib/utils"
import {
  Package, Truck, CheckCircle, Clock, XCircle, FileText,
  ArrowLeft, CreditCard, Building2, MapPin, StickyNote, RotateCcw,
} from "lucide-react"

const statusConfig: Record<string, { label: string; color: "default" | "warning" | "info" | "success" | "danger"; icon: typeof Clock }> = {
  draft: { label: "Ödeme Bekliyor", color: "default", icon: Clock },
  pending_approval: { label: "Onay Bekliyor", color: "warning", icon: Clock },
  approved: { label: "Onaylandı", color: "info", icon: CheckCircle },
  quotation: { label: "Teklif", color: "info", icon: FileText },
  confirmed: { label: "Onaylandı", color: "success", icon: CheckCircle },
  processing: { label: "Hazırlanıyor", color: "info", icon: Package },
  shipped: { label: "Kargoda", color: "info", icon: Truck },
  delivered: { label: "Teslim Edildi", color: "success", icon: CheckCircle },
  cancelled: { label: "İptal Edildi", color: "danger", icon: XCircle },
  returned: { label: "İade", color: "warning", icon: XCircle },
}

const paymentLabels: Record<string, string> = {
  havale: "Havale / EFT",
  online: "Online Ödeme (Kredi Kartı)",
}

const paymentStatusLabels: Record<string, string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  failed: "Başarısız",
}

export default function OrderDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = String(params.id)
  const { data: order, loading, error, refetch } = useData(() => getOrderById(orderId), [orderId])
  const [returnReason, setReturnReason] = useState("")
  const [returning, setReturning] = useState(false)
  const [showReturn, setShowReturn] = useState(false)

  useEffect(() => {
    if (searchParams.get("created") === "1") toast.success("Siparişiniz oluşturuldu")
    if (searchParams.get("paid") === "1") toast.success("Ödemeniz alındı, siparişiniz onaylandı")
  }, [searchParams])

  const status = order ? statusConfig[order.status] : null
  const StatusIcon = status?.icon ?? Clock

  const submitReturn = async () => {
    if (!returnReason.trim()) {
      toast.error("İade nedeni yazın")
      return
    }
    setReturning(true)
    try {
      await requestOrderReturn(orderId, returnReason)
      toast.success("İade talebiniz alındı")
      setShowReturn(false)
      refetch()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İade oluşturulamadı")
    } finally {
      setReturning(false)
    }
  }

  return (
    <Shell>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Siparişlere Dön
        </Link>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {!loading && error && (
          <GlassCard intensity="light" className="p-12 text-center">
            <XCircle size={40} className="mx-auto text-danger mb-4" />
            <p className="text-white/70">{error}</p>
            <Link href="/orders"><Button variant="outline" className="mt-4">Siparişlere Dön</Button></Link>
          </GlassCard>
        )}

        {!loading && order && status && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Header */}
            <GlassCard intensity="medium" className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    status.color === "success" && "bg-success/10 text-success",
                    status.color === "warning" && "bg-warning/10 text-warning",
                    status.color === "danger" && "bg-danger/10 text-danger",
                    status.color === "info" && "bg-info/10 text-info",
                    status.color === "default" && "bg-white/5 text-white/40",
                  )}>
                    <StatusIcon size={22} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">{order.orderNumber}</h1>
                    <p className="text-xs text-white/40">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={status.color} size="md">{status.label}</Badge>
                  {order.status === "draft" && (
                    <Link href={`/payment/${order.id}`}>
                      <Button size="sm" icon={<CreditCard size={14} />}>Ödemeyi Tamamla</Button>
                    </Link>
                  )}
                  {order.status === "delivered" && (
                    <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => setShowReturn((v) => !v)}>
                      İade Talebi
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>

            {showReturn && order.status === "delivered" && (
              <GlassCard intensity="light" className="p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">İade talebi</h2>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="İade nedeninizi yazın…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitReturn} disabled={returning}>
                    {returning ? "Gönderiliyor…" : "Talebi Gönder"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowReturn(false)}>Vazgeç</Button>
                </div>
              </GlassCard>
            )}

            {/* Items */}
            <GlassCard intensity="light" className="p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Ürünler ({order.items.length})</h2>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0">
                      <Package size={18} className="text-white/20" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.productName}</p>
                      <p className="text-[10px] text-white/30 font-mono">{item.sku} • {item.brand}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-white/40">{item.quantity} × {formatPrice(item.unitPrice)}</p>
                      <p className="text-sm font-semibold text-white">{formatPrice(item.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Pricing */}
              <GlassCard intensity="light" className="p-5 space-y-2">
                <h2 className="text-sm font-semibold text-white mb-2">Fiyat Özeti</h2>
                <Row label="Ara Toplam" value={formatPrice(order.pricing.subtotal)} />
                <Row label="Bayi İndirimi" value={`-${formatPrice(order.pricing.discountTotal)}`} valueClass="text-success" />
                {(order.pricing.paymentDiscount ?? 0) > 0 && (
                  <Row label="Havale / EFT İndirimi" value={`-${formatPrice(order.pricing.paymentDiscount)}`} valueClass="text-success" />
                )}
                <Row label="Kargo" value={order.pricing.shippingCost === 0 ? "Ücretsiz" : formatPrice(order.pricing.shippingCost)} />
                <Row label="KDV" value={formatPrice(order.pricing.taxTotal)} />
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-sm font-semibold text-white">Toplam</span>
                  <span className="text-lg font-bold text-accent">{formatPrice(order.pricing.grandTotal)}</span>
                </div>
              </GlassCard>

              {/* Payment & Shipping */}
              <div className="space-y-4">
                <GlassCard intensity="light" className="p-5 space-y-2">
                  <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <CreditCard size={14} className="text-accent" /> Ödeme
                  </h2>
                  <Row label="Yöntem" value={paymentLabels[order.payment.method] ?? order.payment.method ?? "—"} />
                  <Row label="Durum" value={paymentStatusLabels[order.payment.status] ?? order.payment.status ?? "—"} />
                </GlassCard>

                <GlassCard intensity="light" className="p-5 space-y-2">
                  <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <MapPin size={14} className="text-accent" /> Teslimat
                  </h2>
                  <p className="text-xs text-white/50 leading-relaxed">
                    {[order.shipping.address?.street, order.shipping.address?.district, order.shipping.address?.city]
                      .filter(Boolean)
                      .join(", ") || "Adres belirtilmemiş"}
                  </p>
                </GlassCard>
              </div>
            </div>

            {order.notes && (
              <GlassCard intensity="light" className="p-5">
                <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <StickyNote size={14} className="text-accent" /> Sipariş Notu
                </h2>
                <p className="text-sm text-white/60">{order.notes}</p>
              </GlassCard>
            )}
          </motion.div>
        )}
      </div>
    </Shell>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/40">{label}</span>
      <span className={valueClass ?? "text-white"}>{value}</span>
    </div>
  )
}

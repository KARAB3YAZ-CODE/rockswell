"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getOrderById, updateOrderStatus, getAllCompanies, requestOrderReturn, getAllInvoices, updateOrderShipping } from "@/lib/api"
import { adminPath } from "@/lib/admin-host"
import { formatDate, formatPrice, cn } from "@/lib/utils"
import { orderStatusLabels } from "@/components/admin/ui"
import type { Order } from "@/lib/types"
import {
  Package, Truck, CheckCircle, Clock, XCircle, FileText,
  ArrowLeft, CreditCard, MapPin, StickyNote, Building2, RotateCcw, Minus, Plus,
} from "lucide-react"

const statusIcon: Record<string, typeof Clock> = {
  draft: Clock,
  pending_approval: Clock,
  approved: CheckCircle,
  quotation: FileText,
  confirmed: CheckCircle,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
  returned: XCircle,
}

const statusColor: Record<string, "default" | "warning" | "info" | "success" | "danger"> = {
  draft: "default",
  pending_approval: "warning",
  approved: "info",
  quotation: "info",
  confirmed: "success",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  returned: "warning",
}

function nextStatus(status: Order["status"]): { status: Order["status"]; label: string } | null {
  switch (status) {
    case "pending_approval":
    case "quotation":
      return { status: "confirmed", label: "Onayla" }
    case "confirmed":
    case "approved":
      return { status: "processing", label: "Hazırlığa Al" }
    case "processing":
      return { status: "shipped", label: "Kargola" }
    case "shipped":
      return { status: "delivered", label: "Teslim Et" }
    default:
      return null
  }
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: order, loading, error, refetch } = useData(() => getOrderById(id), [id])
  const { data: companies } = useData(() => getAllCompanies(), [])
  const { data: invoices } = useData(() => getAllInvoices(), [])
  const orderInvoice = invoices?.find((inv) => inv.orderId === id)
  const [busy, setBusy] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [returnReason, setReturnReason] = useState("")
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")

  useEffect(() => {
    if (!order) return
    setCarrier(order.shipping.carrier || "")
    setTrackingNumber(order.shipping.trackingNumber || "")
  }, [order?.id, order?.shipping.carrier, order?.shipping.trackingNumber])

  const companyName = companies?.find((c) => c.id === order?.companyId)?.name ?? "—"
  const next = order ? nextStatus(order.status) : null
  const StatusIcon = statusIcon[order?.status ?? ""] ?? Clock
  const color = statusColor[order?.status ?? ""] ?? "default"

  const returnableItems = useMemo(() => {
    if (!order) return []
    return order.items
      .map((item) => {
        const returned = Number(item.returnedQuantity ?? 0)
        const max = Math.max(0, item.quantity - returned)
        return { ...item, returned, max }
      })
      .filter((i) => i.max > 0)
  }, [order])

  const canReturn = order?.status === "delivered" && returnableItems.length > 0

  useEffect(() => {
    if (!showReturn || !order) return
    const init: Record<string, number> = {}
    for (const item of order.items) {
      const max = Math.max(0, item.quantity - Number(item.returnedQuantity ?? 0))
      if (max > 0) init[item.productId] = 0
    }
    setReturnQty(init)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReturn, order?.id])

  const runStatus = async (status: Order["status"], label: string) => {
    setBusy(true)
    try {
      await updateOrderStatus(id, status)
      toast.success(`${label} tamamlandı`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi")
    } finally {
      setBusy(false)
    }
  }

  const setQty = (productId: string, qty: number, max: number) => {
    setReturnQty((prev) => ({ ...prev, [productId]: Math.min(max, Math.max(0, qty)) }))
  }

  const submitReturn = async () => {
    if (!returnReason.trim()) {
      toast.error("İade nedeni yazın")
      return
    }
    const lines = Object.entries(returnQty)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }))
    if (!lines.length) {
      toast.error("İade edilecek ürün adedi seçin")
      return
    }
    setBusy(true)
    try {
      await requestOrderReturn(id, returnReason, lines)
      toast.success("İade kaydedildi")
      setShowReturn(false)
      setReturnReason("")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İade oluşturulamadı")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Link
        href={adminPath("/orders")}
        className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
      >
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
          <Link href={adminPath("/orders")}>
            <Button variant="outline" className="mt-4">Siparişlere Dön</Button>
          </Link>
        </GlassCard>
      )}

      {!loading && order && (
        <div className="space-y-4">
          <GlassCard intensity="medium" className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    color === "success" && "bg-success/10 text-success",
                    color === "warning" && "bg-warning/10 text-warning",
                    color === "danger" && "bg-danger/10 text-danger",
                    color === "info" && "bg-info/10 text-info",
                    color === "default" && "bg-white/5 text-white/40"
                  )}
                >
                  <StatusIcon size={22} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{order.orderNumber}</h1>
                  <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                    <Building2 size={12} /> {companyName} · {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={color} size="md">
                  {orderStatusLabels[order.status] ?? order.status}
                </Badge>
                {next && (
                  <Button size="sm" disabled={busy} onClick={() => runStatus(next.status, next.label)}>
                    {next.label}
                  </Button>
                )}
                {canReturn && (
                  <Button size="sm" variant="secondary" disabled={busy} icon={<RotateCcw size={14} />} onClick={() => setShowReturn((v) => !v)}>
                    İade Al
                  </Button>
                )}
                {orderInvoice && (
                  <Link href={adminPath(`/invoices?q=${encodeURIComponent(orderInvoice.invoiceNumber)}`)}>
                    <Button size="sm" variant="secondary" icon={<FileText size={14} />}>
                      Fatura
                    </Button>
                  </Link>
                )}
                {!["cancelled", "returned", "delivered"].includes(order.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm("Bu siparişi iptal etmek istediğinize emin misiniz? Stok geri alınacak.")) return
                      runStatus("cancelled", "İptal")
                    }}
                  >
                    İptal Et
                  </Button>
                )}
              </div>
            </div>
          </GlassCard>

          {showReturn && canReturn && (
            <GlassCard intensity="light" className="p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Kısmi / tam iade</h2>
                <p className="text-xs text-white/40 mt-1">Satır bazında adet seçin — örn. yalnızca Volvo ürünlerini iade.</p>
              </div>
              <div className="space-y-2">
                {returnableItems.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.productName}</p>
                      <p className="text-[10px] text-white/30 font-mono">
                        {item.brand} · sipariş {item.quantity}
                        {item.returned > 0 ? ` · iade ${item.returned}` : ""} · kalan {item.max}
                      </p>
                    </div>
                    <div className="flex items-center border border-white/10 rounded-lg overflow-hidden shrink-0">
                      <button type="button" onClick={() => setQty(item.productId, (returnQty[item.productId] ?? 0) - 1, item.max)} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5">
                        <Minus size={12} />
                      </button>
                      <span className="w-10 text-center text-xs font-medium text-white">{returnQty[item.productId] ?? 0}</span>
                      <button type="button" onClick={() => setQty(item.productId, (returnQty[item.productId] ?? 0) + 1, item.max)} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5">
                        <Plus size={12} />
                      </button>
                    </div>
                    <button type="button" onClick={() => setQty(item.productId, item.max, item.max)} className="text-[10px] text-accent hover:underline shrink-0">
                      Tümü
                    </button>
                  </div>
                ))}
              </div>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="İade nedeni…"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submitReturn} disabled={busy}>{busy ? "…" : "İadeyi Kaydet"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReturn(false)}>Vazgeç</Button>
              </div>
            </GlassCard>
          )}

          <GlassCard intensity="light" className="p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Ürünler ({order.items.length})</h2>
            <div className="space-y-2">
              {order.items.map((item, idx) => {
                const returned = Number(item.returnedQuantity ?? 0)
                return (
                  <div key={idx} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0">
                      <Package size={18} className="text-white/20" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.productName}</p>
                      <p className="text-[10px] text-white/30 font-mono">
                        {item.sku} · {item.brand}
                      </p>
                      {returned > 0 && (
                        <Badge variant="warning" size="sm" className="mt-1">İade: {returned}/{item.quantity}</Badge>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-white/40">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </p>
                      <p className="text-sm font-semibold text-white">{formatPrice(item.totalPrice)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>

          {(order.returns?.length ?? 0) > 0 && (
            <GlassCard intensity="light" className="p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">İade geçmişi</h2>
              {order.returns.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-1">
                  <p className="text-xs text-white/40">{formatDate(r.createdAt)}</p>
                  <p className="text-sm text-white/70">{r.reason}</p>
                  <p className="text-xs text-white/40">
                    {r.items.map((i) => `${i.productName} × ${i.quantity}`).join(" · ")}
                  </p>
                </div>
              ))}
            </GlassCard>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <GlassCard intensity="light" className="p-5 space-y-2">
              <h2 className="text-sm font-semibold text-white mb-2">Fiyat Özeti</h2>
              <Row label="Ara Toplam" value={formatPrice(order.pricing.subtotal)} />
              <Row label="Bayi İndirimi" value={`-${formatPrice(order.pricing.discountTotal)}`} valueClass="text-success" />
              {(order.pricing.campaignDiscount ?? 0) > 0 && (
                <Row label="Kampanya" value={`-${formatPrice(order.pricing.campaignDiscount)}`} valueClass="text-success" />
              )}
              {(order.pricing.paymentDiscount ?? 0) > 0 && (
                <Row label="Havale İndirimi" value={`-${formatPrice(order.pricing.paymentDiscount)}`} valueClass="text-success" />
              )}
              <Row
                label="Kargo"
                value={order.pricing.shippingCost === 0 ? "Ücretsiz" : formatPrice(order.pricing.shippingCost)}
              />
              <Row label="KDV" value={formatPrice(order.pricing.taxTotal)} />
              <div className="border-t border-white/10 pt-2 flex justify-between">
                <span className="text-sm font-semibold text-white">Toplam</span>
                <span className="text-lg font-bold text-accent">{formatPrice(order.pricing.grandTotal)}</span>
              </div>
            </GlassCard>

            <div className="space-y-4">
              <GlassCard intensity="light" className="p-5 space-y-2">
                <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <CreditCard size={14} className="text-accent" /> Ödeme
                </h2>
                <Row label="Yöntem" value={String(order.payment.method ?? "—")} />
                <Row label="Durum" value={String(order.payment.status ?? "—")} />
              </GlassCard>
              <GlassCard intensity="light" className="p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Truck size={14} className="text-accent" /> Kargo takip
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="Kargo firması (Yurtiçi, Aras…)"
                    className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-accent/40"
                  />
                  <input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Takip numarası"
                    className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-accent/40 font-mono"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={busy || !trackingNumber.trim()}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await updateOrderShipping(id, { carrier, trackingNumber })
                      toast.success("Kargo bilgisi kaydedildi")
                      refetch()
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Kaydet{trackingNumber.trim() && order.status !== "shipped" && order.status !== "delivered" ? " ve kargola" : ""}
                </Button>
                <p className="text-[10px] text-white/30">
                  Takip no kaydedilince bayiye bildirim gider; durum uygunsa sipariş “Kargoda” olur.
                </p>
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
                <StickyNote size={14} className="text-accent" /> Not
              </h2>
              <p className="text-sm text-white/60 whitespace-pre-wrap">{order.notes}</p>
            </GlassCard>
          )}
        </div>
      )}
    </div>
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

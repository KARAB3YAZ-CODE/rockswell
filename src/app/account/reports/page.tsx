"use client"

import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/hooks/use-data"
import { getDashboardStats, getInvoices, getOrders } from "@/lib/api"
import { formatPrice, formatDate } from "@/lib/utils"
import { BarChart3, Package, Wallet, Truck } from "lucide-react"
import Link from "next/link"

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]

export default function ReportsPage() {
  const { data: stats, loading: statsLoading } = useData(() => getDashboardStats(), [])
  const { data: invoices, loading: invLoading } = useData(() => getInvoices(), [])
  const { data: orders, loading: ordLoading } = useData(() => getOrders(), [])
  const loading = statsLoading || invLoading || ordLoading

  const paid = (invoices ?? []).filter((i) => i.status === "paid")
  const open = (invoices ?? []).filter((i) => ["sent", "overdue"].includes(i.status))
  const shipped = (orders ?? []).filter((o) => ["shipped", "delivered"].includes(o.status))
  const maxSale = Math.max(1, ...(stats?.monthlySales ?? [0]))

  return (
    <Shell>
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Raporlar</h2>
          <p className="text-sm text-white/40">Firmanızın sipariş, fatura ve sevkiyat özeti</p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-4 gap-3">
              <GlassCard intensity="light" className="p-4">
                <p className="text-xs text-white/40">Ortalama sipariş</p>
                <p className="text-lg font-bold text-white mt-1">{formatPrice(stats?.averageOrderValue ?? 0)}</p>
              </GlassCard>
              <GlassCard intensity="light" className="p-4">
                <p className="text-xs text-white/40">Açık fatura</p>
                <p className="text-lg font-bold text-warning mt-1">{formatPrice(stats?.openInvoicesAmount ?? 0)}</p>
              </GlassCard>
              <GlassCard intensity="light" className="p-4">
                <p className="text-xs text-white/40">Kredi limiti</p>
                <p className="text-lg font-bold text-white mt-1">{formatPrice(stats?.creditLimit ?? 0)}</p>
              </GlassCard>
              <GlassCard intensity="light" className="p-4">
                <p className="text-xs text-white/40">Bugün sipariş</p>
                <p className="text-lg font-bold text-accent mt-1">{stats?.todayOrders ?? 0}</p>
              </GlassCard>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <GlassCard intensity="light" className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-accent" />
                  <h3 className="text-sm font-semibold text-white">Satış (aylık)</h3>
                </div>
                <div className="flex items-end gap-1.5 h-32">
                  {(stats?.monthlySales ?? Array(12).fill(0)).map((v, i) => (
                    <div key={MONTHS[i]} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className="w-full rounded-t bg-accent/70 min-h-[2px]"
                        style={{ height: `${(v / maxSale) * 100}%` }}
                        title={formatPrice(v)}
                      />
                      <span className="text-[9px] text-white/30">{MONTHS[i]}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard intensity="light" className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-accent" />
                  <h3 className="text-sm font-semibold text-white">En çok alınan ürünler</h3>
                </div>
                {(stats?.topProducts?.length ?? 0) === 0 ? (
                  <p className="text-sm text-white/40">Henüz veri yok</p>
                ) : (
                  <div className="space-y-2">
                    {stats!.topProducts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-white/70 truncate">{p.name}</span>
                        <span className="text-white/40 shrink-0">{p.quantity} adet · {formatPrice(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard intensity="light" className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-accent" />
                    <h3 className="text-sm font-semibold text-white">Finansal</h3>
                  </div>
                  <Link href="/account/invoices" className="text-xs text-accent hover:underline">Faturalar</Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 p-3">
                    <p className="text-[11px] text-white/40">Ödenen</p>
                    <p className="text-sm font-semibold text-success mt-0.5">{paid.length} · {formatPrice(paid.reduce((s, i) => s + i.grandTotal, 0))}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-3">
                    <p className="text-[11px] text-white/40">Açık</p>
                    <p className="text-sm font-semibold text-warning mt-0.5">{open.length} · {formatPrice(open.reduce((s, i) => s + i.grandTotal, 0))}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard intensity="light" className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-accent" />
                  <h3 className="text-sm font-semibold text-white">Lojistik</h3>
                </div>
                {shipped.length === 0 ? (
                  <p className="text-sm text-white/40">Sevkiyat kaydı yok</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {shipped.slice(0, 8).map((o) => (
                      <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between gap-2 text-sm hover:bg-white/[0.03] rounded-lg px-2 py-1.5 -mx-2">
                        <div>
                          <p className="text-white/80">{o.orderNumber}</p>
                          <p className="text-[10px] text-white/30">{formatDate(o.createdAt)}</p>
                        </div>
                        <Badge size="sm" variant={o.status === "delivered" ? "success" : "info"}>
                          {o.status === "delivered" ? "Teslim" : "Kargoda"}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}

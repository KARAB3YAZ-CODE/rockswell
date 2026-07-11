"use client"

import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getAdminReports } from "@/lib/api"
import { formatPrice, cn } from "@/lib/utils"
import { SectionHeader, orderStatusLabels } from "@/components/admin/ui"
import {
  BarChart3,
  ShoppingBag,
  Clock,
  DollarSign,
  CalendarDays,
  TrendingUp,
  XCircle,
  FileText,
} from "lucide-react"

export default function AdminReportsPage() {
  const { data: report, loading } = useData(() => getAdminReports(), [])
  const maxTrend = Math.max(1, ...(report?.trend.map((t) => t.revenue) ?? [1]))

  return (
    <div className="space-y-6">
      <SectionHeader icon={BarChart3} tone="accent" title="Raporlar & Analiz" subtitle="Sipariş, ciro ve dönemsel performans" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Ciro", value: report ? formatPrice(report.revenue) : "—", icon: DollarSign },
          { label: "Toplam Sipariş", value: report?.orderCount ?? "—", icon: ShoppingBag },
          { label: "Onay Bekleyen", value: report?.pendingApproval ?? "—", icon: Clock },
          { label: "Ort. Sipariş", value: report ? formatPrice(report.avgOrderValue) : "—", icon: BarChart3 },
        ].map((c) => {
          const Icon = c.icon
          return (
            <GlassCard key={c.label} intensity="light" className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Icon size={16} className="text-white/30" />
              </div>
              {loading ? <Skeleton className="h-7 w-20 mb-1" /> : <p className="text-xl font-bold text-white">{c.value}</p>}
              <p className="text-xs text-white/40">{c.label}</p>
            </GlassCard>
          )
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Bu Ay Ciro", value: report ? formatPrice(report.monthlyRevenue) : "—", icon: CalendarDays, sub: report ? `${report.monthlyOrders} sipariş` : undefined },
          { label: "Son 30 Gün Ciro", value: report ? formatPrice(report.last30DaysRevenue) : "—", icon: TrendingUp, sub: report ? `${report.last30DaysOrders} sipariş` : undefined },
          { label: "İptal", value: report?.cancelledCount ?? "—", icon: XCircle },
          { label: "Teklif / Taslak", value: report?.quotationCount ?? "—", icon: FileText },
        ].map((c) => {
          const Icon = c.icon
          return (
            <GlassCard key={c.label} intensity="light" className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Icon size={16} className="text-white/30" />
              </div>
              {loading ? <Skeleton className="h-7 w-20 mb-1" /> : <p className="text-xl font-bold text-white">{c.value}</p>}
              <p className="text-xs text-white/40">{c.label}</p>
              {c.sub && <p className="text-[11px] text-white/25 mt-0.5">{c.sub}</p>}
            </GlassCard>
          )
        })}
      </div>

      <GlassCard intensity="light" className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Son 6 Ay Ciro Trendi</h3>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex items-end gap-2 h-40">
            {(report?.trend ?? []).map((t) => (
              <div key={t.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] text-white/35 tabular-nums">{t.revenue > 0 ? formatPrice(t.revenue) : "—"}</span>
                <div
                  className={cn("w-full rounded-t-md bg-accent/80 min-h-[4px] transition-all")}
                  style={{ height: `${Math.max(4, (t.revenue / maxTrend) * 100)}%` }}
                  title={`${t.orders} sipariş`}
                />
                <span className="text-xs text-white/50">{t.label}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard intensity="light" className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Firma Bazlı Ciro (Top 20)</h3>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (report?.byCompany.length ?? 0) === 0 ? (
            <p className="text-sm text-white/40">Veri yok</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {report!.byCompany.map((c) => (
                <div key={c.companyId} className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                  <div>
                    <p className="text-white/80">{c.companyName}</p>
                    <p className="text-xs text-white/30">{c.orders} sipariş</p>
                  </div>
                  <span className="font-medium text-accent">{formatPrice(c.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard intensity="light" className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Sipariş Durumları</h3>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(report?.byStatus ?? []).map((s) => (
                <Badge key={s.status} variant="default" size="sm">
                  {orderStatusLabels[s.status] ?? s.status}: {s.count}
                </Badge>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

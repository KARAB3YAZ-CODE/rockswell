"use client"

import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getAdminReports } from "@/lib/api"
import { adminPath } from "@/lib/admin-host"
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
  Download,
} from "lucide-react"
import toast from "react-hot-toast"

type ReportRange = "all" | "30" | "90" | "month"

const RANGE_OPTIONS: { id: ReportRange; label: string }[] = [
  { id: "all", label: "Tüm zamanlar" },
  { id: "month", label: "Bu ay" },
  { id: "30", label: "Son 30 gün" },
  { id: "90", label: "Son 90 gün" },
]

export default function AdminReportsPage() {
  const [range, setRange] = useState<ReportRange>("all")
  const { data: report, loading } = useData(() => getAdminReports(range), [range])
  const maxTrend = Math.max(1, ...(report?.trend.map((t) => t.revenue) ?? [1]))

  const exportCsv = () => {
    if (!report?.byCompany.length) {
      toast.error("Dışa aktarılacak veri yok")
      return
    }
    const lines = [
      "Firma,Sipariş,Ciro",
      ...report.byCompany.map((c) =>
        `"${c.companyName.replace(/"/g, '""')}",${c.orders},${c.revenue}`
      ),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rockswell-firma-ciro-${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV indirildi")
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={BarChart3}
        tone="accent"
        title="Raporlar & Analiz"
        subtitle="Sipariş, ciro ve dönemsel performans"
        action={
          <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={exportCsv}>
            CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={cn(
              "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
              range === r.id
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Dönem Cirosu", value: report ? formatPrice(report.revenue) : "—", icon: DollarSign },
          { label: "Dönem Sipariş", value: report?.orderCount ?? "—", icon: ShoppingBag },
          {
            label: "Onay Bekleyen",
            value: report?.pendingApproval ?? "—",
            icon: Clock,
            href: `${adminPath("/orders")}?status=pending_approval`,
          },
          { label: "Ort. Sipariş", value: report ? formatPrice(report.avgOrderValue) : "—", icon: BarChart3 },
        ].map((c) => {
          const Icon = c.icon
          const inner = (
            <GlassCard key={c.label} intensity="light" className="p-4 h-full hover:border-accent/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <Icon size={16} className="text-white/30" />
              </div>
              {loading ? <Skeleton className="h-7 w-20 mb-1" /> : <p className="text-xl font-bold text-white">{c.value}</p>}
              <p className="text-xs text-white/40">{c.label}</p>
            </GlassCard>
          )
          return c.href ? (
            <Link key={c.label} href={c.href}>{inner}</Link>
          ) : (
            <div key={c.label}>{inner}</div>
          )
        })}
      </div>

      {range === "all" && (
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
      )}

      {range !== "all" && (
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "İptal (dönem)", value: report?.cancelledCount ?? "—", icon: XCircle },
          { label: "Teklif / Taslak (dönem)", value: report?.quotationCount ?? "—", icon: FileText },
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
      )}

      <GlassCard intensity="light" className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Son 6 Ay Ciro Trendi</h3>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex items-end gap-2 h-40">
            {(report?.trend ?? []).map((t) => (
              <Link
                key={t.label}
                href={`${adminPath("/orders")}?month=${t.label}`}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                title={`${t.orders} sipariş · ${formatPrice(t.revenue)}`}
              >
                <span className="text-[10px] text-white/35 tabular-nums group-hover:text-accent transition-colors">
                  {t.revenue > 0 ? formatPrice(t.revenue) : "—"}
                </span>
                <div
                  className="w-full rounded-t-md bg-accent/80 min-h-[4px] transition-all group-hover:bg-accent"
                  style={{ height: `${Math.max(4, (t.revenue / maxTrend) * 100)}%` }}
                />
                <span className="text-xs text-white/50 group-hover:text-white/70">{t.label}</span>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard intensity="light" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Firma Bazlı Ciro (Top 20)</h3>
            <button type="button" onClick={exportCsv} className="text-[11px] text-accent hover:underline inline-flex items-center gap-1">
              <Download size={12} /> CSV
            </button>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (report?.byCompany.length ?? 0) === 0 ? (
            <p className="text-sm text-white/40">Veri yok</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {report!.byCompany.map((c) => (
                <Link
                  key={c.companyId}
                  href={`${adminPath("/orders")}?company=${encodeURIComponent(c.companyName)}`}
                  className="flex items-center justify-between text-sm py-2 border-b border-white/5 hover:bg-white/[0.02] rounded-lg px-1 -mx-1 transition-colors"
                >
                  <div>
                    <p className="text-white/80 hover:text-accent">{c.companyName}</p>
                    <p className="text-xs text-white/30">{c.orders} sipariş</p>
                  </div>
                  <span className="font-medium text-accent">{formatPrice(c.revenue)}</span>
                </Link>
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
                <Link key={s.status} href={`${adminPath("/orders")}?status=${encodeURIComponent(s.status)}`}>
                  <Badge variant="default" size="sm" className="hover:border-accent/40 cursor-pointer">
                    {orderStatusLabels[s.status] ?? s.status}: {s.count}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

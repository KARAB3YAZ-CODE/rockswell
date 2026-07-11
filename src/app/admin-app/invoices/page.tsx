"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableSkeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getAllInvoices, updateInvoiceStatus } from "@/lib/api"
import { adminPath } from "@/lib/admin-host"
import { formatPrice, formatDate, cn } from "@/lib/utils"
import { SectionHeader, inputCls } from "@/components/admin/ui"
import { FileText, Search, ShoppingBag, CheckCircle2, Download } from "lucide-react"
import { downloadTextFile, invoicesToAccountingCsv } from "@/lib/accounting-export"

const statusLabels: Record<string, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
}

const STATUS_FILTERS = [
  { id: "all", label: "Tümü" },
  { id: "paid", label: "Ödendi" },
  { id: "sent", label: "Gönderildi" },
  { id: "overdue", label: "Gecikmiş" },
  { id: "draft", label: "Taslak" },
  { id: "cancelled", label: "İptal" },
] as const

const DATE_PRESETS = [
  { id: "all", label: "Tüm zamanlar", days: null as number | null },
  { id: "30", label: "Son 30 gün", days: 30 },
  { id: "90", label: "Son 90 gün", days: 90 },
  { id: "month", label: "Bu ay", days: -1 },
] as const

export default function AdminInvoicesPage() {
  const { data: invoices, loading, refetch } = useData(() => getAllInvoices(), [])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [datePreset, setDatePreset] = useState<(typeof DATE_PRESETS)[number]["id"]>("all")
  const [markingId, setMarkingId] = useState<string | null>(null)

  const markPaid = async (id: string) => {
    setMarkingId(id)
    try {
      await updateInvoiceStatus(id, "paid")
      toast.success("Fatura ödendi olarak işaretlendi")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi")
    } finally {
      setMarkingId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const preset = DATE_PRESETS.find((p) => p.id === datePreset)
    const cutoff =
      preset?.days === -1
        ? monthStart
        : preset?.days
          ? new Date(now.getTime() - preset.days * 864e5)
          : null

    return (invoices ?? []).filter((inv) => {
      if (status !== "all" && inv.status !== status) return false
      if (cutoff && new Date(inv.createdAt) < cutoff) return false
      if (!q) return true
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.companyName ?? "").toLowerCase().includes(q)
      )
    })
  }, [invoices, search, status, datePreset])

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={FileText}
        tone="info"
        title="Faturalar"
        subtitle={`${filtered.length} / ${invoices?.length ?? 0} fatura`}
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={<Download size={14} />}
            onClick={() => {
              if (!filtered.length) {
                toast.error("Dışa aktarılacak fatura yok")
                return
              }
              downloadTextFile(
                `rockswell-faturalar-${new Date().toISOString().slice(0, 10)}.csv`,
                invoicesToAccountingCsv(filtered)
              )
              toast.success("Muhasebe CSV indirildi")
            }}
          >
            Muhasebe CSV
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Fatura no veya firma ara…"
            className={cn(inputCls, "pl-9")}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={cn(
                "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
                status === f.id
                  ? "bg-accent/15 border-accent/40 text-accent"
                  : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDatePreset(p.id)}
              className={cn(
                "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
                datePreset === p.id
                  ? "bg-info/15 border-info/40 text-info"
                  : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : (invoices?.length ?? 0) === 0 ? (
          <div className="text-center py-12">
            <FileText size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40 mb-3">Henüz fatura yok</p>
            <Link href={adminPath("/orders")} className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
              <ShoppingBag size={12} /> Siparişlere git
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Search size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40">Filtrelere uyan fatura yok</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-white/30 p-3">Fatura</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Firma</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Durum</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Tarih</th>
                  <th className="text-right text-xs font-medium text-white/30 p-3">Tutar</th>
                  <th className="text-right text-xs font-medium text-white/30 p-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="p-3 text-sm text-white/80">
                      <Link
                        href={inv.orderId ? adminPath(`/orders/${inv.orderId}`) : adminPath("/orders")}
                        className="hover:text-accent"
                      >
                        {inv.invoiceNumber || inv.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="p-3 text-sm text-white/60">{inv.companyName ?? "—"}</td>
                    <td className="p-3">
                      <Badge
                        size="sm"
                        variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "default"}
                      >
                        {statusLabels[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-white/50">{formatDate(inv.createdAt)}</td>
                    <td className="p-3 text-right text-sm font-medium text-white">{formatPrice(inv.grandTotal)}</td>
                    <td className="p-3 text-right">
                      {inv.status !== "paid" && inv.status !== "cancelled" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={markingId === inv.id}
                          onClick={() => markPaid(inv.id)}
                          icon={<CheckCircle2 size={12} />}
                        >
                          {markingId === inv.id ? "…" : "Ödendi"}
                        </Button>
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

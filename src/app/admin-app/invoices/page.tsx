"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getAllInvoices } from "@/lib/api"
import { siteAbsoluteUrl } from "@/lib/admin-host"
import { formatPrice, formatDate } from "@/lib/utils"
import { SectionHeader } from "@/components/admin/ui"
import { FileText, Search } from "lucide-react"

const statusLabels: Record<string, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
}

export default function AdminInvoicesPage() {
  const { data: invoices, loading } = useData(() => getAllInvoices(), [])
  const [search, setSearch] = useState("")

  const rows = (invoices ?? []).filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.companyName ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <SectionHeader icon={FileText} tone="info" title="Faturalar" subtitle={`${invoices?.length ?? 0} fatura`} />
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Fatura no veya firma ara..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-white/40">Fatura bulunamadı</div>
        ) : (
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-white/30 p-4">Fatura</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">Firma</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">Durum</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">Tarih</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                    <td className="p-4 text-sm text-white/80">
                      <a href={siteAbsoluteUrl(`/orders/${inv.orderId}`)} className="hover:text-accent">
                        {inv.invoiceNumber || inv.id.slice(0, 8)}
                      </a>
                    </td>
                    <td className="p-4 text-sm text-white/60">{inv.companyName ?? "—"}</td>
                    <td className="p-4">
                      <Badge
                        size="sm"
                        variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "default"}
                      >
                        {statusLabels[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-white/50">{formatDate(inv.createdAt)}</td>
                    <td className="p-4 text-right text-sm font-medium text-white">{formatPrice(inv.grandTotal)}</td>
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

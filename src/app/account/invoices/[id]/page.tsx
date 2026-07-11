"use client"

import { use, useEffect } from "react"
import Link from "next/link"
import { Shell } from "@/components/layout/shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getInvoiceById } from "@/lib/api"
import { formatDate, formatPrice } from "@/lib/utils"
import { downloadInvoicePdf } from "@/lib/invoice-pdf"
import { ArrowLeft, Printer, FileText, Download } from "lucide-react"

const statusLabel: Record<string, string> = {
  draft: "Taslak",
  sent: "Bekliyor",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: inv, loading, error } = useData(() => getInvoiceById(id), [id])

  useEffect(() => {
    document.title = inv ? `Fatura ${inv.invoiceNumber}` : "Fatura"
  }, [inv])

  if (loading) {
    return (
      <Shell>
        <div className="max-w-3xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </Shell>
    )
  }

  if (error || !inv) {
    return (
      <Shell>
        <div className="max-w-3xl text-center py-16 space-y-3">
          <FileText size={40} className="mx-auto text-white/20" />
          <p className="text-white/50">{typeof error === "string" ? error : "Fatura bulunamadı"}</p>
          <Link href="/account/invoices"><Button variant="secondary">Faturalara dön</Button></Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-3xl space-y-4 print:max-w-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <Link href="/account/invoices" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
            <ArrowLeft size={14} /> Faturalar
          </Link>
          <div className="flex flex-wrap gap-2">
            {inv.orderId && (
              <Link href={`/orders/${inv.orderId}`}>
                <Button size="sm" variant="secondary">Sipariş</Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={<Download size={14} />}
              onClick={() => downloadInvoicePdf(inv)}
            >
              PDF İndir
            </Button>
            <Button size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>
              Yazdır
            </Button>
          </div>
        </div>

        <article className="rounded-2xl border border-white/10 bg-card p-6 sm:p-8 space-y-6 print:border-0 print:bg-white print:text-black print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 print:border-black/20 pb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40 print:text-black/50">ROCKSWELL</p>
              <h1 className="text-2xl font-bold text-white print:text-black mt-1">{inv.invoiceNumber}</h1>
              <p className="text-sm text-white/40 print:text-black/60 mt-1">
                {inv.companyName ?? "Firma"} · {formatDate(inv.createdAt)}
              </p>
            </div>
            <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "info"} size="md">
              {statusLabel[inv.status] ?? inv.status}
            </Badge>
          </header>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40 print:text-black/50 text-xs mb-1">Vade</p>
              <p className="text-white print:text-black">{formatDate(inv.dueDate)}</p>
            </div>
            {inv.paidDate && (
              <div>
                <p className="text-white/40 print:text-black/50 text-xs mb-1">Ödeme tarihi</p>
                <p className="text-white print:text-black">{formatDate(inv.paidDate)}</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-white/10 print:border-black/20 text-left text-white/40 print:text-black/50">
                <th className="py-2 font-medium">Açıklama</th>
                <th className="py-2 font-medium text-right">Adet</th>
                <th className="py-2 font-medium text-right">Birim</th>
                <th className="py-2 font-medium text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={i} className="border-b border-white/5 print:border-black/10">
                  <td className="py-2.5 text-white print:text-black">{item.description}</td>
                  <td className="py-2.5 text-right text-white/70 print:text-black/70">{item.quantity}</td>
                  <td className="py-2.5 text-right text-white/70 print:text-black/70">{formatPrice(item.unitPrice)}</td>
                  <td className="py-2.5 text-right text-white print:text-black font-medium">{formatPrice(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="space-y-1.5 text-sm max-w-xs ml-auto">
            <div className="flex justify-between text-white/50 print:text-black/60">
              <span>Ara toplam</span>
              <span>{formatPrice(inv.subtotal)}</span>
            </div>
            {inv.discountTotal > 0 && (
              <div className="flex justify-between text-white/50 print:text-black/60">
                <span>İndirim</span>
                <span>-{formatPrice(inv.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-white/50 print:text-black/60">
              <span>KDV</span>
              <span>{formatPrice(inv.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-accent print:text-black border-t border-white/10 print:border-black/20 pt-2">
              <span>Genel toplam</span>
              <span>{formatPrice(inv.grandTotal)}</span>
            </div>
          </div>

          <p className="text-[11px] text-white/30 print:text-black/40 pt-4">
            Bu belge elektronik ortamda üretilmiştir. PDF için tarayıcıdan Yazdır → PDF olarak kaydet kullanın.
          </p>
        </article>
      </div>
    </Shell>
  )
}

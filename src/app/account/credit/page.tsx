"use client"

import Link from "next/link"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import { getMyCreditLedger } from "@/lib/api"
import { formatDate, formatPrice } from "@/lib/utils"
import { creditLedgerToCsv, downloadTextFile } from "@/lib/accounting-export"
import { Button } from "@/components/ui/button"
import { CreditCard, ArrowUpRight, ArrowDownLeft, Download } from "lucide-react"
import toast from "react-hot-toast"

export default function CreditLedgerPage() {
  const { data, loading } = useData(() => getMyCreditLedger(), [])

  const snap = data?.snapshot
  const entries = data?.entries ?? []

  return (
    <Shell>
      <div className="max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Cari / Kredi</h2>
            <p className="text-sm text-white/40">Açık hesap kullanımı ve fatura hareketleri</p>
          </div>
          {entries.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Download size={14} />}
              onClick={() => {
                downloadTextFile(
                  `rockswell-cari-${new Date().toISOString().slice(0, 10)}.csv`,
                  creditLedgerToCsv(entries)
                )
                toast.success("Cari CSV indirildi")
              }}
            >
              CSV
            </Button>
          )}
        </div>

        {loading || !snap ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <GlassCard intensity="light" className="p-4">
                <p className="text-xs text-white/40">Limit</p>
                <p className="text-lg font-bold text-white mt-1">{formatPrice(snap.creditLimit)}</p>
              </GlassCard>
              <GlassCard intensity="light" className="p-4">
                <p className="text-xs text-white/40">Kullanılan</p>
                <p className="text-lg font-bold text-warning mt-1">{formatPrice(snap.creditUsed)}</p>
              </GlassCard>
              <GlassCard intensity="light" className="p-4">
                <p className="text-xs text-white/40">Kalan</p>
                <p className="text-lg font-bold text-accent mt-1">{formatPrice(snap.creditRemaining)}</p>
              </GlassCard>
            </div>

            <GlassCard intensity="light" className="p-4 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={14} className="text-accent" />
                <h3 className="text-sm font-semibold text-white">Hareketler</h3>
              </div>
              {entries.length === 0 ? (
                <p className="text-xs text-white/40 py-4 text-center">Henüz hareket yok</p>
              ) : (
                entries.map((e) => (
                  <Link
                    key={e.id}
                    href={e.link || "#"}
                    className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] rounded-lg px-1 -mx-1"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        e.kind === "invoice_paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}
                    >
                      {e.kind === "invoice_paid" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{e.label}</p>
                      <p className="text-[10px] text-white/35">{formatDate(e.date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${e.amount < 0 ? "text-success" : "text-white"}`}>
                        {e.amount < 0 ? "" : "+"}
                        {formatPrice(Math.abs(e.amount))}
                      </p>
                      <Badge
                        variant={e.kind === "invoice_paid" ? "success" : e.kind === "order_pending" ? "warning" : "info"}
                        size="sm"
                      >
                        {e.kind === "invoice_paid" ? "Ödendi" : e.kind === "order_pending" ? "Bekleyen" : "Açık"}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </GlassCard>
          </>
        )}
      </div>
    </Shell>
  )
}

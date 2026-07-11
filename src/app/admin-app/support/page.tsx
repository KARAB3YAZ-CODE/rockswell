"use client"

import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionHeader } from "@/components/admin/ui"
import { useData } from "@/hooks/use-data"
import { getAllSupportTickets, updateSupportTicketStatus } from "@/lib/api"
import { formatDate, cn } from "@/lib/utils"
import { MessageSquare } from "lucide-react"

const statusOpts = [
  { id: "all", label: "Tümü" },
  { id: "open", label: "Açık" },
  { id: "in_progress", label: "İşlemde" },
  { id: "closed", label: "Kapalı" },
] as const

export default function AdminSupportPage() {
  const { data: tickets, loading, refetch } = useData(() => getAllSupportTickets(), [])
  const [filter, setFilter] = useState<string>("open")
  const [busyId, setBusyId] = useState<string | null>(null)

  const list = useMemo(() => {
    const rows = tickets ?? []
    if (filter === "all") return rows
    return rows.filter((t) => t.status === filter)
  }, [tickets, filter])

  const setStatus = async (id: string, status: "open" | "in_progress" | "closed") => {
    setBusyId(id)
    try {
      await updateSupportTicketStatus(id, status)
      toast.success("Durum güncellendi")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={MessageSquare}
        tone="accent"
        title="Destek Talepleri"
        subtitle="Bayilerden gelen destek kayıtları"
      />

      <div className="flex flex-wrap gap-1.5">
        {statusOpts.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setFilter(s.id)}
            className={cn(
              "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
              filter === s.id
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <GlassCard intensity="light" className="p-10 text-center text-sm text-white/40">
          Bu filtrede talep yok
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <GlassCard key={t.id} intensity="light" className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{t.subject}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">
                    {formatDate(t.createdAt)} · {t.category}
                    {t.companyName ? ` · ${t.companyName}` : ""}
                    {t.userEmail ? ` · ${t.userEmail}` : ""}
                  </p>
                </div>
                <Badge
                  variant={t.status === "open" ? "warning" : t.status === "closed" ? "default" : "info"}
                  size="sm"
                >
                  {t.status === "open" ? "Açık" : t.status === "closed" ? "Kapalı" : "İşlemde"}
                </Badge>
              </div>
              <p className="text-sm text-white/60 whitespace-pre-wrap">{t.message}</p>
              <div className="flex flex-wrap gap-2">
                {t.status !== "in_progress" && (
                  <Button size="sm" variant="secondary" disabled={busyId === t.id} onClick={() => setStatus(t.id, "in_progress")}>
                    İşleme Al
                  </Button>
                )}
                {t.status !== "closed" && (
                  <Button size="sm" disabled={busyId === t.id} onClick={() => setStatus(t.id, "closed")}>
                    Kapat
                  </Button>
                )}
                {t.status === "closed" && (
                  <Button size="sm" variant="ghost" disabled={busyId === t.id} onClick={() => setStatus(t.id, "open")}>
                    Yeniden Aç
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

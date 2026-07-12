"use client"

import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionHeader } from "@/components/admin/ui"
import { useData } from "@/hooks/use-data"
import {
  getAllSupportTickets,
  updateSupportTicketStatus,
  getSupportTicketMessages,
  replySupportTicket,
  type AdminSupportTicket,
  type SupportTicketMessage,
} from "@/lib/api"
import { formatDate, cn } from "@/lib/utils"
import { MessageSquare, Send, ArrowLeft } from "lucide-react"

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
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null)
  const [thread, setThread] = useState<SupportTicketMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState("")

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
      if (selected?.id === id) setSelected({ ...selected, status })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi")
    } finally {
      setBusyId(null)
    }
  }

  const openTicket = async (t: AdminSupportTicket) => {
    setSelected(t)
    setThreadLoading(true)
    try {
      setThread(await getSupportTicketMessages(t.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mesajlar yüklenemedi")
    } finally {
      setThreadLoading(false)
    }
  }

  const sendReply = async () => {
    if (!selected || !reply.trim()) return
    setBusyId(selected.id)
    try {
      const msg = await replySupportTicket(selected.id, reply)
      setThread((prev) => [...prev, msg])
      setReply("")
      toast.success("Yanıt gönderildi")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gönderilemedi")
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
        subtitle="Bayilerden gelen destek kayıtları ve yanıtlar"
      />

      {selected ? (
        <div className="space-y-3 max-w-3xl">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white"
          >
            <ArrowLeft size={14} /> Listeye dön
          </button>
          <GlassCard intensity="light" className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{selected.subject}</p>
                <p className="text-[11px] text-white/35 mt-0.5">
                  {selected.companyName || "—"} · {selected.userName || selected.userEmail || "—"}
                </p>
              </div>
              <Badge
                variant={selected.status === "open" ? "warning" : selected.status === "closed" ? "default" : "info"}
                size="sm"
              >
                {selected.status === "open" ? "Açık" : selected.status === "closed" ? "Kapalı" : "İşlemde"}
              </Badge>
            </div>
            {threadLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl p-3 text-sm ${
                      m.isStaff
                        ? "bg-accent/10 border border-accent/20 mr-4"
                        : "bg-white/[0.03] border border-white/5 ml-4"
                    }`}
                  >
                    <p className="text-[10px] text-white/35 mb-1">
                      {m.isStaff ? "Rockswell" : m.authorName || "Bayi"} · {formatDate(m.createdAt)}
                    </p>
                    <p className="text-white/80 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Yanıt yazın…"
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 resize-none"
              />
              <Button size="sm" icon={<Send size={14} />} disabled={busyId === selected.id} onClick={sendReply}>
                Gönder
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status !== "closed" && (
                <Button size="sm" variant="secondary" disabled={busyId === selected.id} onClick={() => setStatus(selected.id, "closed")}>
                  Kapat
                </Button>
              )}
              {selected.status === "closed" && (
                <Button size="sm" variant="ghost" disabled={busyId === selected.id} onClick={() => setStatus(selected.id, "open")}>
                  Yeniden Aç
                </Button>
              )}
            </div>
          </GlassCard>
        </div>
      ) : (
        <>
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
                <button key={t.id} type="button" className="w-full text-left" onClick={() => openTicket(t)}>
                  <GlassCard intensity="light" className="p-4 space-y-2 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{t.subject}</p>
                        <p className="text-[11px] text-white/35 mt-0.5">
                          {formatDate(t.createdAt)} · {t.category}
                          {t.companyName ? ` · ${t.companyName}` : ""}
                          {t.userName ? ` · ${t.userName}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={t.status === "open" ? "warning" : t.status === "closed" ? "default" : "info"}
                        size="sm"
                      >
                        {t.status === "open" ? "Açık" : t.status === "closed" ? "Kapalı" : "İşlemde"}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/50 line-clamp-2">{t.message}</p>
                  </GlassCard>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

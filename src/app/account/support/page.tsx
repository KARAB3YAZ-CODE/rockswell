"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketMessages,
  replySupportTicket,
  type SupportTicket,
  type SupportTicketMessage,
} from "@/lib/api"
import { useData } from "@/hooks/use-data"
import { formatDate } from "@/lib/utils"
import { MessageSquare, Send, ArrowLeft } from "lucide-react"
import Link from "next/link"

const CATEGORIES = [
  { id: "siparis", label: "Sipariş" },
  { id: "fatura", label: "Fatura / Ödeme" },
  { id: "urun", label: "Ürün / Stok" },
  { id: "hesap", label: "Hesap" },
  { id: "genel", label: "Genel" },
] as const

const statusLabel: Record<string, { label: string; color: "info" | "success" | "warning" | "default" }> = {
  open: { label: "Açık", color: "info" },
  in_progress: { label: "İşlemde", color: "warning" },
  closed: { label: "Kapalı", color: "default" },
}

export default function SupportPage() {
  const { isAuthenticated, loading } = useAuth()
  const [category, setCategory] = useState<string>("genel")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [thread, setThread] = useState<SupportTicketMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState("")
  const [replying, setReplying] = useState(false)

  const { data: tickets, loading: ticketsLoading, refetch } = useData(
    () => (isAuthenticated ? getMySupportTickets() : Promise.resolve([])),
    [isAuthenticated]
  )

  const openTicket = async (t: SupportTicket) => {
    setSelected(t)
    setThreadLoading(true)
    try {
      const msgs = await getSupportTicketMessages(t.id)
      setThread(msgs)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mesajlar yüklenemedi")
    } finally {
      setThreadLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.error("Destek talebi için giriş yapın")
      return
    }
    if (!subject.trim() || !message.trim()) {
      toast.error("Konu ve mesaj gerekli")
      return
    }
    setSubmitting(true)
    try {
      const created = await createSupportTicket({ subject, category, message })
      setSubject("")
      setMessage("")
      toast.success("Destek talebiniz alındı")
      refetch()
      await openTicket(created)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Talep oluşturulamadı")
    } finally {
      setSubmitting(false)
    }
  }

  const sendReply = async () => {
    if (!selected || !reply.trim()) return
    setReplying(true)
    try {
      const msg = await replySupportTicket(selected.id, reply)
      setThread((prev) => [...prev, msg])
      setReply("")
      toast.success("Yanıt gönderildi")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gönderilemedi")
    } finally {
      setReplying(false)
    }
  }

  if (loading) return null

  return (
    <Shell>
      <div className="max-w-3xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Destek</h2>
          <p className="text-sm text-white/40">Sipariş, fatura ve hesap konularında bize yazın</p>
        </div>

        {!isAuthenticated ? (
          <GlassCard intensity="light" className="p-6 text-center space-y-3">
            <p className="text-white/60">Destek talebi için giriş yapın</p>
            <Link href="/login"><Button>Giriş Yap</Button></Link>
          </GlassCard>
        ) : selected ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white"
            >
              <ArrowLeft size={14} /> Taleplere dön
            </button>
            <GlassCard intensity="light" className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{selected.subject}</h3>
                  <p className="text-xs text-white/35 mt-0.5">{formatDate(selected.createdAt)}</p>
                </div>
                <Badge variant={statusLabel[selected.status]?.color ?? "default"} size="sm">
                  {statusLabel[selected.status]?.label ?? selected.status}
                </Badge>
              </div>
              {threadLoading ? (
                <Skeleton className="h-24 w-full rounded-lg" />
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {thread.length === 0 && (
                    <p className="text-xs text-white/40 whitespace-pre-wrap">{selected.message}</p>
                  )}
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl p-3 text-sm ${
                        m.isStaff
                          ? "bg-accent/10 border border-accent/20 ml-4"
                          : "bg-white/[0.03] border border-white/5 mr-4"
                      }`}
                    >
                      <p className="text-[10px] text-white/35 mb-1">
                        {m.isStaff ? "Rockswell" : m.authorName || "Siz"} · {formatDate(m.createdAt)}
                      </p>
                      <p className="text-white/80 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
              {selected.status !== "closed" && (
                <div className="flex gap-2 pt-2">
                  <textarea
                    rows={2}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Yanıt yazın…"
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 resize-none"
                  />
                  <Button size="sm" icon={<Send size={14} />} disabled={replying} onClick={sendReply}>
                    {replying ? "…" : "Gönder"}
                  </Button>
                </div>
              )}
            </GlassCard>
          </div>
        ) : (
          <>
            <GlassCard intensity="light" className="p-5">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        category === c.id
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Konu"
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"
                />
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mesajınız…"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 resize-none"
                />
                <Button type="submit" disabled={submitting} icon={<Send size={14} />}>
                  {submitting ? "Gönderiliyor…" : "Talep oluştur"}
                </Button>
              </form>
            </GlassCard>

            <div>
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <MessageSquare size={14} className="text-accent" /> Talepleriniz
              </h3>
              {ticketsLoading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : !tickets?.length ? (
                <p className="text-xs text-white/35">Henüz destek talebi yok</p>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTicket(t)}
                      className="w-full text-left"
                    >
                      <GlassCard intensity="light" className="p-4 hover:bg-white/[0.03] transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-white truncate">{t.subject}</p>
                          <Badge variant={statusLabel[t.status]?.color ?? "default"} size="sm">
                            {statusLabel[t.status]?.label ?? t.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/35 mt-1">{formatDate(t.createdAt)}</p>
                      </GlassCard>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}

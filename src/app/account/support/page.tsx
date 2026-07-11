"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { createSupportTicket, getMySupportTickets } from "@/lib/api"
import { useData } from "@/hooks/use-data"
import { formatDate } from "@/lib/utils"
import { MessageSquare, Send } from "lucide-react"
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
  resolved: { label: "Çözüldü", color: "success" },
}

export default function SupportPage() {
  const { isAuthenticated, loading } = useAuth()
  const [category, setCategory] = useState<string>("genel")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const { data: tickets, loading: ticketsLoading, refetch } = useData(
    () => (isAuthenticated ? getMySupportTickets() : Promise.resolve([])),
    [isAuthenticated]
  )

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
      await createSupportTicket({ subject, category, message })
      setSent(true)
      setSubject("")
      setMessage("")
      toast.success("Destek talebiniz alındı")
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Talep oluşturulamadı")
    } finally {
      setSubmitting(false)
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
            <MessageSquare size={40} className="mx-auto text-white/20" />
            <p className="text-white/60">Destek talebi oluşturmak için giriş yapmanız gerekir.</p>
            <Link href="/login">
              <Button>Giriş Yap</Button>
            </Link>
          </GlassCard>
        ) : sent ? (
          <GlassCard intensity="light" className="p-6 text-center space-y-3">
            <MessageSquare size={40} className="mx-auto text-accent" />
            <p className="text-white font-medium">Talebiniz alındı</p>
            <p className="text-sm text-white/50">Ekibimiz en kısa sürede e-posta ile dönüş yapacaktır.</p>
            <Button variant="secondary" onClick={() => setSent(false)}>Yeni talep</Button>
          </GlassCard>
        ) : (
          <GlassCard intensity="light" className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Konu</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        category === c.id
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-white/10 text-white/50 hover:text-white"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Başlık</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Kısa özet"
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Mesaj</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Sorununuzu veya talebinizi yazın…"
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 resize-none"
                />
              </div>
              <Button type="submit" disabled={submitting} icon={<Send size={14} />}>
                {submitting ? "Gönderiliyor…" : "Talep Gönder"}
              </Button>
            </form>
          </GlassCard>
        )}

        {isAuthenticated && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white/70">Taleplerim</h3>
            {ticketsLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (tickets?.length ?? 0) === 0 ? (
              <p className="text-xs text-white/35 py-2">Henüz destek talebiniz yok.</p>
            ) : (
              tickets!.map((t) => {
                const st = statusLabel[t.status] ?? statusLabel.open
                return (
                  <GlassCard key={t.id} intensity="light" className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                        <p className="text-xs text-white/40 mt-0.5">{formatDate(t.createdAt)} · {t.category}</p>
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">{t.message}</p>
                      </div>
                      <Badge variant={st.color} size="sm">{st.label}</Badge>
                    </div>
                  </GlassCard>
                )
              })
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { SectionHeader, inputCls } from "@/components/admin/ui"
import { askAdminAssistant } from "@/lib/api"
import { cn, formatPrice } from "@/lib/utils"
import { ADMIN_PATH_PREFIX } from "@/lib/admin-host"
import {
  Bot, Check, Package, RotateCcw, Send, Sparkles, User, X,
} from "lucide-react"

type Choice = { id: string; label: string }
type Pending = { tool: string; args: Record<string, unknown> } | null
type ProductCard = {
  type: "product"
  id?: string
  title: string
  subtitle?: string
  image?: string
  sku?: string
  price?: number
  stock?: number
  badges?: { label: string; tone?: "warning" | "danger" | "accent" | "muted" | "success" }[]
}
type Msg = {
  role: "user" | "assistant"
  content: string
  cards?: ProductCard[]
}

const SUGGESTIONS = [
  "Düşük stok",
  "Kategorileri listele",
  "Firmaları listele",
  "Onay bekleyen siparişler",
  "Son siparişler",
  "Kampanyaları listele",
  "İş özeti ver",
  "Komutlar",
]

const badgeTone: Record<string, string> = {
  warning: "bg-warning/15 text-warning border-warning/25",
  danger: "bg-danger/15 text-danger border-danger/25",
  accent: "bg-accent/15 text-accent border-accent/25",
  success: "bg-success/15 text-success border-success/25",
  muted: "bg-white/5 text-white/45 border-white/10",
}

function ProductCards({ cards }: { cards: ProductCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 w-full max-w-2xl">
      {cards.map((card, i) => (
        <div
          key={`${card.id ?? card.sku ?? i}-${card.title}`}
          className="group flex gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-2.5 hover:border-white/15 transition-colors"
        >
          <div className="w-16 h-16 rounded-xl bg-black/30 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
            {card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <Package size={20} className="text-white/20" />
            )}
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-sm font-medium text-white truncate leading-snug">{card.title}</p>
            {card.subtitle && (
              <p className="text-[11px] text-white/40 truncate mt-0.5">{card.subtitle}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {(card.badges ?? []).map((b) => (
                <span
                  key={`${b.label}-${b.tone}`}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md border font-medium",
                    badgeTone[b.tone ?? "muted"]
                  )}
                >
                  {b.label}
                </span>
              ))}
            </div>
            {typeof card.price === "number" && (
              <p className="text-xs text-white/70 mt-1.5 font-medium tabular-nums">
                {formatPrice(card.price)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminAssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Merhaba! Komut yazın veya kısayollara tıklayın. Ürün listeleri fotoğraflı kart olarak gelir; belirsiz isimlerde seçenek, kritik işlemlerde Onayla / İptal, sonrasında Geri al görünür.",
    },
  ])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<Pending>(null)
  const [undoAction, setUndoAction] = useState<Pending>(null)
  const [choices, setChoices] = useState<Choice[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const awaitingConfirm = Boolean(pendingAction && pendingAction.tool !== "_pick")
  const awaitingPick = pendingAction?.tool === "_pick"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, busy, choices, pendingAction, undoAction])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    const nextMessages: Msg[] = [...messages, { role: "user", content }]
    setMessages(nextMessages)
    setInput("")
    setBusy(true)
    setChoices([])
    try {
      const history = nextMessages
        .filter((m, i) => !(i === 0 && m.role === "assistant"))
        .map((m) => ({ role: m.role, content: m.content }))
      const res = await askAdminAssistant(history, pendingAction, undoAction)
      setPendingAction(res.pendingAction ?? null)
      setUndoAction(res.undoAction ?? null)
      setChoices(res.choices ?? [])
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          cards: res.cards,
        },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Bir hata oluştu",
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-[calc(100vh-3rem)] max-w-4xl flex flex-col gap-4">
      <SectionHeader
        icon={Bot}
        tone="accent"
        title="AI Asistan"
        subtitle="Ücretsiz — modern kartlar, seçenekler, onay ve geri al"
      />

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => send(s)}
            className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/55 hover:text-white hover:border-accent/35 hover:bg-accent/5 transition-colors disabled:opacity-40"
          >
            <Sparkles size={10} className="inline mr-1 opacity-60" />
            {s}
          </button>
        ))}
      </div>

      <GlassCard intensity="light" className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col border-white/[0.07]">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_20px_-8px_rgba(57,255,20,0.5)]">
                  <Bot size={15} className="text-accent" />
                </div>
              )}
              <div className={cn("min-w-0", m.role === "user" ? "max-w-[85%]" : "max-w-[min(100%,42rem)] flex-1")}>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-accent text-black rounded-br-md"
                      : "bg-white/[0.04] border border-white/[0.08] text-white/85 rounded-bl-md"
                  )}
                >
                  {m.content}
                </div>
                {m.role === "assistant" && m.cards && m.cards.length > 0 && (
                  <ProductCards cards={m.cards} />
                )}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={15} className="text-white/60" />
                </div>
              )}
            </div>
          ))}

          {choices.length > 0 && !busy && (
            <div className="pl-10 space-y-2">
              <p className="text-[11px] text-white/40 font-medium tracking-wide uppercase">
                {awaitingPick ? "Bunu mu demek istediniz?" : "Hızlı seçim"}
              </p>
              <div className="flex flex-wrap gap-2">
                {choices.map((c) => (
                  <button
                    key={`${c.id}-${c.label}`}
                    type="button"
                    disabled={busy}
                    onClick={() => send(awaitingPick ? c.id : c.label)}
                    className="text-xs px-3 py-2 rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-left max-w-full"
                  >
                    {awaitingPick ? `${c.id}) ${c.label}` : c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(awaitingConfirm || awaitingPick || undoAction) && !busy && (
            <div className="pl-10 flex flex-wrap gap-2 pt-1">
              {awaitingConfirm && (
                <button
                  type="button"
                  onClick={() => send("onayla")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-accent text-black hover:bg-accent/90 shadow-lg shadow-accent/10"
                >
                  <Check size={14} /> Onayla
                </button>
              )}
              {(awaitingConfirm || awaitingPick) && (
                <button
                  type="button"
                  onClick={() => send("iptal")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5"
                >
                  <X size={14} /> İptal
                </button>
              )}
              {undoAction && !awaitingConfirm && (
                <button
                  type="button"
                  onClick={() => send("geri al")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border border-warning/30 bg-warning/10 text-warning hover:bg-warning/15"
                >
                  <RotateCcw size={14} /> Geri al
                </button>
              )}
            </div>
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-white/40 pl-10">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              İşleniyor…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="p-3 sm:p-4 border-t border-white/[0.08] flex gap-2 bg-black/20"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              awaitingPick
                ? "Seçenek numarası veya ad yazın…"
                : awaitingConfirm
                  ? "Onayla / İptal veya yeni komut…"
                  : "Örn: Düşük stok · Fren kategorisine %15 zam"
            }
            disabled={busy}
            className={cn(inputCls, "flex-1 rounded-xl")}
          />
          <Button type="submit" disabled={busy || !input.trim()} icon={<Send size={14} />}>
            Gönder
          </Button>
        </form>
      </GlassCard>

      <p className="text-[11px] text-white/30">
        Ürün sonuçları fotoğraflı kart olarak gösterilir. Ürün düzenlemek için{" "}
        <a href={`${ADMIN_PATH_PREFIX}/products`} className="text-accent/70 hover:text-accent">
          Ürünler
        </a>{" "}
        sayfasını kullanın.
      </p>
    </div>
  )
}

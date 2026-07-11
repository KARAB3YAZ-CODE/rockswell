"use client"

import { useEffect, useRef, useState } from "react"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { SectionHeader, inputCls } from "@/components/admin/ui"
import { askAdminAssistant } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Bot, Check, RotateCcw, Send, Sparkles, User, X } from "lucide-react"

type Msg = { role: "user" | "assistant"; content: string }
type Pending = { tool: string; args: Record<string, unknown> } | null
type Choice = { id: string; label: string }

const SUGGESTIONS = [
  "Kategorileri listele",
  "Firmaları listele",
  "Onay bekleyen siparişler",
  "Son siparişler",
  "Kampanyaları listele",
  "Düşük stok",
  "Depoları listele",
  "İş özeti ver",
  "Komutlar",
]

export default function AdminAssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Merhaba! Komut yazın veya aşağıdaki kısayollara tıklayın. Belirsiz isimlerde “Bunu mu demek istediniz?” seçenekleri çıkar. Kritik işlemlerde Onayla / İptal, uygulanan işlemlerde Geri al butonu görünür.",
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
      const history = nextMessages.filter((m, i) => !(i === 0 && m.role === "assistant"))
      const res = await askAdminAssistant(history, pendingAction, undoAction)
      setPendingAction(res.pendingAction ?? null)
      setUndoAction(res.undoAction ?? null)
      setChoices(res.choices ?? [])
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }])
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
    <div className="h-[calc(100vh-3rem)] max-w-3xl flex flex-col gap-4">
      <SectionHeader
        icon={Bot}
        tone="accent"
        title="AI Asistan"
        subtitle="Ücretsiz — seçenekli, onaylı, geri alınabilir işlemler"
      />

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => send(s)}
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/55 hover:text-white hover:border-accent/30 hover:bg-accent/5 transition-colors disabled:opacity-40"
          >
            <Sparkles size={10} className="inline mr-1 opacity-60" />
            {s}
          </button>
        ))}
      </div>

      <GlassCard intensity="light" className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-accent" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-accent text-black rounded-br-md"
                    : "bg-white/[0.05] border border-white/10 text-white/85 rounded-bl-md"
                )}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={14} className="text-white/60" />
                </div>
              )}
            </div>
          ))}

          {choices.length > 0 && !busy && (
            <div className="pl-9 space-y-2">
              <p className="text-[11px] text-white/40">
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
            <div className="pl-9 flex flex-wrap gap-2 pt-1">
              {awaitingConfirm && (
                <button
                  type="button"
                  onClick={() => send("onayla")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-accent text-black hover:bg-accent/90"
                >
                  <Check size={14} /> Onayla
                </button>
              )}
              {(awaitingConfirm || awaitingPick) && (
                <button
                  type="button"
                  onClick={() => send("iptal")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5"
                >
                  <X size={14} /> İptal
                </button>
              )}
              {undoAction && !awaitingConfirm && (
                <button
                  type="button"
                  onClick={() => send("geri al")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-warning/30 bg-warning/10 text-warning hover:bg-warning/15"
                >
                  <RotateCcw size={14} /> Geri al
                </button>
              )}
            </div>
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-white/40 pl-9">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              İşleniyor…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="p-3 border-t border-white/10 flex gap-2"
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
                  : "Örn: Fren kategorisine %15 zam yap"
            }
            disabled={busy}
            className={cn(inputCls, "flex-1")}
          />
          <Button type="submit" disabled={busy || !input.trim()} icon={<Send size={14} />}>
            Gönder
          </Button>
        </form>
      </GlassCard>

      <p className="text-[11px] text-white/30">
        Ücretsiz yerel asistan. Seçeneklere tıklayın · Onayla/İptal · işlem sonrası Geri al.
      </p>
    </div>
  )
}
